from backend.app.services.email import _extract_first_name, _to_czech_vocative


def test_extract_first_name_trims_punctuation():
    assert _extract_first_name("Matěj, Novák") == "Matěj"


def test_czech_vocative_for_matej():
    assert _to_czech_vocative("Matěj") == "Matěji"


def test_czech_vocative_for_martin():
    assert _to_czech_vocative("Martin") == "Martine"

