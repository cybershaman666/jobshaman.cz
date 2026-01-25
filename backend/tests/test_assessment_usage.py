from fastapi.testclient import TestClient
import pytest

import backend.app.main as main


class MockResponse:
    def __init__(self, data=None):
        self.data = data


class MockSupabase:
    def __init__(self):
        # store fake DB state
        self._tables = {}
        # default subscription and usage
        self._subscriptions = {}
        self._usage = {}
        self._last_table = None
        self._operation = None
        self._insert_payload = None
        self._update_payload = None
        self._filters = {}

    def table(self, name):
        self._last_table = name
        self._operation = None
        self._filters = {}
        return self

    def select(self, *_args, **_kwargs):
        self._operation = 'select'
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def insert(self, payload):
        self._operation = 'insert'
        self._insert_payload = payload
        return self

    def update(self, payload):
        self._operation = 'update'
        self._update_payload = payload
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, n):
        return self

    def single(self):
        return self

    def execute(self):
        # handle specific table operations
        if self._last_table == 'assessment_invitations' and self._operation == 'select':
            inv_id = self._filters.get('id')
            inv = self._tables.get('assessment_invitations', {}).get(inv_id)
            return MockResponse(data=[inv] if inv else None)

        if self._last_table == 'assessment_results' and self._operation == 'insert':
            # simulate insert returning id
            new_id = 'res_123'
            return MockResponse(data=[{"id": new_id}])

        if self._last_table == 'assessment_invitations' and self._operation == 'update':
            # simulate update success
            return MockResponse(data=[{"updated": True}])

        if self._last_table == 'subscriptions' and self._operation == 'select':
            # return subscription row for company_id or user_id
            if 'company_id' in self._filters:
                cid = self._filters['company_id']
                sub = self._subscriptions.get(cid)
                return MockResponse(data=[sub] if sub else None)
            if 'user_id' in self._filters:
                uid = self._filters['user_id']
                sub = self._subscriptions.get(uid)
                return MockResponse(data=[sub] if sub else None)

        if self._last_table == 'subscription_usage' and self._operation == 'select':
            sub_id = self._filters.get('subscription_id')
            usage = self._usage.get(sub_id)
            return MockResponse(data=[usage] if usage else None)

        return MockResponse(data=None)

    def rpc(self, name, params):
        # increment assessment usage for given company_id
        class RPC:
            def __init__(self, outer, params):
                self.outer = outer
                self.params = params

            def execute(self):
                cid = self.params.get('company_id')
                # find subscription_id mapping
                sub = None
                for k, v in self.outer._subscriptions.items():
                    if v.get('company_id') == cid or k == cid:
                        sub = v
                        break
                # increment usage stored in self.outer._usage keyed by subscription id
                # assume subscription has 'id'
                subscription_id = sub.get('id') if sub else cid
                if subscription_id not in self.outer._usage:
                    self.outer._usage[subscription_id] = {'ai_assessments_used': 0, 'active_jobs_count': 0}
                self.outer._usage[subscription_id]['ai_assessments_used'] = self.outer._usage[subscription_id].get('ai_assessments_used', 0) + 1
                return MockResponse(data=[self.outer._usage[subscription_id]])

        return RPC(self, params)


@pytest.fixture(autouse=True)
def mock_supabase(monkeypatch):
    mock = MockSupabase()

    # setup fake invitation
    invitation_id = 'inv_123'
    company_id = 'comp_1'
    mock._tables['assessment_invitations'] = {
        invitation_id: {
            'id': invitation_id,
            'company_id': company_id,
            'candidate_id': 'cand_1',
            'candidate_email': 'test@example.com',
            'invitation_token': 'tok_abc',
            'expires_at': '2099-01-01T00:00:00Z',
            'status': 'pending',
        }
    }

    # setup subscription record keyed by company id
    mock._subscriptions[company_id] = {
        'id': 'sub_1',
        'company_id': company_id,
        'tier': 'assessment_bundle',
        'status': 'active',
        'ai_assessments_used': 0,
    }

    # no usage initially
    mock._usage['sub_1'] = {'ai_assessments_used': 0, 'active_jobs_count': 0}

    monkeypatch.setattr(main, 'supabase', mock)
    # Monkeypatch get_current_user to return company admin for subscription-status calls
    async def _fake_current_user(credentials=None):
        return {'id': 'comp_1', 'company_name': 'TestCo', 'email': 'admin@testco'}

    monkeypatch.setattr(main, 'get_current_user', _fake_current_user)
    return mock


def test_submit_increments_usage_and_subscription_status(client: None, mock_supabase):
    client = TestClient(main.app)

    # submit assessment result using token
    invitation_id = 'inv_123'
    res = client.post(f"/assessments/invitations/{invitation_id}/submit?token=tok_abc", json={
        'invitation_id': invitation_id,
        'assessment_id': 'asm_1',
        'role': 'Candidate',
        'difficulty': 'Senior',
        'questions_total': 3,
        'questions_correct': 2,
        'score': 66.6,
        'time_spent_seconds': 120,
        'answers': { '0': 'a', '1': 'b' },
    })

    assert res.status_code == 200
    body = res.json()
    assert body.get('status') == 'success'

    # Now call subscription-status to see updated usage
    # userId must match current user in get_current_user; get_current_user enforces equality; but subscription-status uses get_current_user to match.
    # For test, we call with the same userId as in subscription record (company id is used for company admin path). Use the company id.
    resp2 = client.get(f"/subscription-status?userId=comp_1")
    assert resp2.status_code == 200
    data = resp2.json()
    # assessmentsUsed should reflect increment (1)
    assert data.get('assessmentsUsed') == 1
