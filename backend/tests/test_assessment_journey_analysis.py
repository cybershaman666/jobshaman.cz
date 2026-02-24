from fastapi.testclient import TestClient

import backend.app.main as main


def test_journey_analyze_answer_returns_pattern_payload():
    client = TestClient(main.app)
    res = client.post('/assessments/journey/analyze-answer', json={
        'phase': 1,
        'question_text': 'Jak byste rozhodl v nejistotě?',
        'answer': 'Nejdřív nastavím priority, potom rizika a transparentně komunikuji týmový plán.',
        'answers_so_far': ['Chci mít jasný postup a měřit dopad přes KPI.'],
    })
    assert res.status_code == 200
    data = res.json()
    assert 'micro_insight' in data
    assert 'decision_pattern' in data
    assert 'behavioral_consistency' in data
    assert 'energy_balance' in data
    assert 'cultural_orientation' in data
    assert 'below threshold' not in str(data).lower()
    assert 'personality score' not in str(data).lower()


def test_journey_finalize_returns_final_profile_with_energy_hours():
    client = TestClient(main.app)
    res = client.post('/assessments/journey/finalize', json={
        'answers': [
            'Musím doručit výsledek, ale chci zachovat kvalitu a sdílet kontext se stakeholdery.',
            'Nejdřív řeším priority, pak dělám risk mitigation a iteruji.',
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert 'final_profile' in data
    assert 'energy_balance' in data
    assert int(data['energy_balance']['monthly_energy_hours_left']) > 0
