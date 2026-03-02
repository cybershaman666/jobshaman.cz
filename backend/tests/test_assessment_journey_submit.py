from fastapi.testclient import TestClient
import pytest
import sys
import types

if "pymongo" not in sys.modules:
    pymongo_stub = types.ModuleType("pymongo")
    pymongo_stub.ASCENDING = 1

    class _MongoClient:
        def __init__(self, *args, **kwargs):
            pass

    pymongo_stub.MongoClient = _MongoClient
    sys.modules["pymongo"] = pymongo_stub
    collection_stub = types.ModuleType("pymongo.collection")

    class _Collection:
        pass

    collection_stub.Collection = _Collection
    sys.modules["pymongo.collection"] = collection_stub

import backend.app.main as main
import backend.app.routers.assessments as assessments_router


class MockResponse:
    def __init__(self, data=None):
        self.data = data


class MockSupabaseJourney:
    def __init__(self):
        self._last_table = None
        self._operation = None
        self._filters = {}
        self._insert_payload = None
        self._update_payload = None
        self._tables = {
            'assessment_invitations': {
                'inv_1': {
                    'id': 'inv_1',
                    'company_id': 'comp_1',
                    'candidate_id': 'cand_1',
                    'candidate_email': 'candidate@example.com',
                    'invitation_token': 'tok_1',
                    'expires_at': '2099-01-01T00:00:00Z',
                    'status': 'pending',
                }
            },
            'assessment_results': {
                'by_invitation_id': {}
            }
        }

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

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self._last_table == 'assessment_invitations' and self._operation == 'select':
            inv = self._tables['assessment_invitations'].get(self._filters.get('id'))
            return MockResponse(data=[inv] if inv else None)
        if self._last_table == 'assessment_results' and self._operation == 'select':
            inv_id = self._filters.get('invitation_id')
            row = self._tables['assessment_results']['by_invitation_id'].get(inv_id)
            return MockResponse(data=[row] if row else [])
        if self._last_table == 'assessment_results' and self._operation == 'insert':
            row = {'id': 'res_1', **(self._insert_payload or {})}
            inv_id = row.get('invitation_id')
            if inv_id:
                self._tables['assessment_results']['by_invitation_id'][inv_id] = row
            return MockResponse(data=[row])
        if self._last_table == 'assessment_results' and self._operation == 'update':
            row_id = self._filters.get('id')
            for inv_id, row in list(self._tables['assessment_results']['by_invitation_id'].items()):
                if row.get('id') == row_id:
                    updated = {**row, **(self._update_payload or {})}
                    self._tables['assessment_results']['by_invitation_id'][inv_id] = updated
                    return MockResponse(data=[updated])
            return MockResponse(data=[{'id': row_id, **(self._update_payload or {})}])
        if self._last_table == 'assessment_invitations' and self._operation == 'update':
            inv_id = self._filters.get('id')
            if inv_id and inv_id in self._tables['assessment_invitations']:
                self._tables['assessment_invitations'][inv_id] = {
                    **self._tables['assessment_invitations'][inv_id],
                    **(self._update_payload or {}),
                }
            return MockResponse(data=[{'ok': True}])
        return MockResponse(data=None)

    def rpc(self, _name, _params):
        class RPC:
            def execute(self):
                return MockResponse(data=[{'ok': True}])

        return RPC()


@pytest.fixture
def mock_supabase(monkeypatch):
    mock = MockSupabaseJourney()
    monkeypatch.setattr(assessments_router, 'supabase', mock)
    return mock


def test_journey_submit_writes_canonical_fields(mock_supabase):
    client = TestClient(main.app)

    payload = {
        'invitation_id': 'inv_1',
        'assessment_id': 'asm_1',
        'role': 'Engineer',
        'difficulty': 'Journey',
        'questions_total': 2,
        'time_spent_seconds': 120,
        'answers': {
            'journey_version': 'journey-v1',
            'technical': {'q1': 'Nejdřív nastavím priority.'},
            'psychometric': {},
            'decision_pattern': {
                'structured_vs_improv': 65,
                'risk_tolerance': 50,
                'sequential_vs_parallel': 61,
                'stakeholder_orientation': 58,
                'uncertainty_markers': []
            },
            'behavioral_consistency': {
                'recurring_motifs': [],
                'consistency_pairs': [],
                'preference_scenario_tensions': []
            },
            'energy_balance': {
                'enthusiasm_markers': [],
                'exhaustion_markers': [],
                'must_vs_want_ratio': 1.0,
                'locus_of_control': 'internal',
                'monthly_energy_hours_left': 74
            },
            'cultural_orientation': {
                'transparency': 'high',
                'conflict_response': 'direct',
                'hierarchy_vs_autonomy': 'autonomy',
                'process_vs_outcome': 'process',
                'stability_vs_dynamics': 'dynamic'
            },
            'journey_trace': {'phase_events': [], 'micro_insights': [], 'mode_switches': []},
            'final_profile': {
                'transferable_strengths': ['structured decisions'],
                'risk_zones': ['pressure overload'],
                'amplify_environments': ['transparent feedback'],
                'drain_environments': ['low transparency']
            },
            'ai_disclaimer': {'text': 'AI poskytuje interpretaci vzorců. Rozhodnutí je na vás.', 'shown_at_phase': [1, 2, 3, 4, 5]},
            'assessment_mode_used': 'classic',
            'mode_switch_count': 0,
            'mode_switch_timestamps': []
        },
    }

    res = client.post('/assessments/invitations/inv_1/submit?token=tok_1', json=payload)
    assert res.status_code == 200
    inserted = mock_supabase._insert_payload
    assert inserted['journey_version'] == 'journey-v1'
    assert isinstance(inserted['journey_payload'], dict)
    assert inserted['journey_quality_index'] is not None
    assert inserted['legacy_mapped'] is False


def test_journey_submit_is_idempotent_for_completed_invitation(mock_supabase):
    client = TestClient(main.app)

    mock_supabase._tables['assessment_invitations']['inv_1']['status'] = 'completed'
    mock_supabase._tables['assessment_results']['by_invitation_id']['inv_1'] = {
        'id': 'res_existing',
        'invitation_id': 'inv_1',
        'completed_at': '2099-01-01T00:00:00Z',
    }

    payload = {
        'invitation_id': 'inv_1',
        'assessment_id': 'asm_1',
        'role': 'Engineer',
        'difficulty': 'Journey',
        'questions_total': 2,
        'time_spent_seconds': 120,
        'answers': {
            'journey_version': 'journey-v1',
            'decision_pattern': {'structured_vs_improv': 65},
            'energy_balance': {},
            'cultural_orientation': {},
            'final_profile': {}
        },
    }

    res = client.post('/assessments/invitations/inv_1/submit?token=tok_1', json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body['status'] == 'success'
    assert body['result_id'] == 'res_existing'
    assert body['deduplicated'] is True
