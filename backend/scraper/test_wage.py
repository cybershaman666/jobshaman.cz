import re

def parse_salary(stxt):
    # This is what's currently in the code (Jobs.cz/Prace.cz style)
    nums = re.findall(r"\d[\d\s]*", stxt)
    vals = [
        int(x.replace(" ", "").replace("\u00a0", "").replace(".", ""))
        for x in nums if x.strip()
    ]
    return vals

def parse_salary_v2(stxt):
    # Proposed improvement
    # Include dots and commas (as thousands separators) in regex
    nums = re.findall(r"\d[\d\s\.,]*", stxt)
    vals = []
    for x in nums:
        cleaned = re.sub(r"[^\d]", "", x)
        if cleaned:
            v = int(cleaned)
            # If it's a decimal like 35.000,00 -> we might need to handle the part after comma
            # but usually wages are whole numbers.
            # However, if we got "35,000" and the comma was decimal -> 35000 is still 35000.
            # If it was "35.000,50" -> 3500050? Bad.
            
            # Better check for decimals: if there's a comma followed by 2 digits at the end
            # of the segment, it's likely decimal.
            if ',' in x:
                parts = x.split(',')
                if len(parts) > 1 and len(parts[-1].strip()) == 2:
                    # Decimal part, drop it for integer wages
                    v = int(re.sub(r"[^\d]", "", parts[0]))
            
            vals.append(v)
            
    # Handle "tis" / "tisíc" multiplier
    if "tis" in stxt.lower():
        # Check if values are small (e.g. 35)
        if vals and all(v < 1000 for v in vals):
            vals = [v * 1000 for v in vals]
            
    return vals

test_cases = [
    "35 000 - 45 000 Kč",
    "35.000 - 45.000 Kč",
    "35,000 - 45,000 Kč",
    "35 - 45 tis. Kč",
    "35 - 45 tisíc Kč",
    "35000",
    "35 000,00 Kč",
]

print(f"{'Input':<25} | {'V1 (Current)':<20} | {'V2 (Improved)':<20}")
print("-" * 70)
for tc in test_cases:
    v1 = parse_salary(tc)
    v2 = parse_salary_v2(tc)
    print(f"{tc:<25} | {str(v1):<20} | {str(v2):<20}")
