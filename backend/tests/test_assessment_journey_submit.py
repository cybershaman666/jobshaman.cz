from fastapi.testclient import TestClient
import pytest

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

    def update(self, _payload):
        self._operation = 'update'
        return self

    def execute(self):
        if self._last_table == 'assessment_invitations' and self._operation == 'select':
            inv = self._tables['assessment_invitations'].get(self._filters.get('id'))
            return MockResponse(data=[inv] if inv else None)
        if self._last_table == 'assessment_results' and self._operation == 'insert':
            return MockResponse(data=[{'id': 'res_1'}])
        if self._last_table == 'assessment_invitations' and self._operation == 'update':
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
