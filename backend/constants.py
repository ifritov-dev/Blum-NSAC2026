"""Domain constants, parameter regexes, and series tags for NASA PSI."""

import re

O2_INCLUDE = re.compile(r"\bX?O2\b|oxygen|\bO\s+initial|O₂", re.I)
O2_EXCLUDE = re.compile(r"\brate\b|mg/s|sccm", re.I)

PARAM_PATTERNS = {
    "Pressure": re.compile(r"pressure|^p(init|final|mean)\b|^approx p\b", re.I),
    "Airflow": re.compile(r"air flow|air rate|air display|fan|velocity|flow restrictor", re.I),
    "Fuel/material": re.compile(r"fuel|material|fiber|sample type", re.I),
    "Sample/burner size": re.compile(r"thickness|length|width|diameter|nozzle|burner size", re.I),
    "Diluent (N₂/He/CO₂)": re.compile(r"nitrogen|helium|\bn2\b|\bhe\b|n initial|he initial|co2|gas mixture", re.I),
    "Temperature": re.compile(r"temp|^tad\b", re.I),
    "Combustion result": re.compile(r"burn time|burn length|spread|extinction|burning rate|ignited|hot ignition", re.I),
    "Cameras/sensors": re.compile(r"camera|radiometer|frames", re.I),
}

DOMAIN_TAGS: dict[str, tuple[str, str]] = {
    "SAFFIRE-1": ("MSG / Large-scale", "Flammability / Spacecraft"),
    "SAFFIRE-2": ("MSG / Large-scale", "Flammability / Spacecraft"),
    "SAFFIRE-3": ("MSG / Large-scale", "Flammability / Spacecraft"),
    "BASS": ("MSG (SPICE duct)", "Solid Flammability"),
    "BASS-II": ("MSG (SPICE duct)", "Solid Flammability"),
    "SPICE": ("MSG (SPICE duct)", "Smoke Point / Gaseous Co-flow"),
    "SPICE (Data Summary)": ("MSG (SPICE duct)", "Reference Summary"),
    "SLICE": ("MSG (SPICE duct)", "Flame Structure & Liftoff"),
    "FLEX": ("CIR / MDCA", "Suppression & Droplet Extinction (CO2/He)"),
    "FLEX-2": ("CIR / MDCA", "Droplet Combustion"),
    "CFI": ("CIR / MDCA", "Cool Flames (Droplets)"),
    "CFI-G": ("CIR / ACME", "Cool Flames (Gases, high O2)"),
    "ACME / Flame Design": ("CIR / ACME", "Soot & Flame Design"),
    "ACME / BRE": ("CIR / ACME", "Burning Rate Emulator (Flammability)"),
    "ACME / CLD Flame": ("CIR / ACME", "Coflow Laminar Diffusion"),
    "ACME / E-FIELD Flames": ("CIR / ACME", "Electric-Field Partial-g Proxy"),
    "ACME / s-Flame": ("CIR / ACME", "Spherical Flame / Extinction"),
    "SAME": ("ISS / Aerosol", "Smoke & Aerosol Detection"),
    "SAME-R": ("ISS / Aerosol", "Smoke & Aerosol Detection"),
    "DAFT": ("ISS / Aerosol", "Dust Measurement Feasibility"),
}

CHALLENGE_CONTEXT = (
    "Reference context from the NASA Space Apps Challenge (not in PSI CSV tables unless noted):\n"
    "- Habitable environments: Earth sea level = 21% O2 at 14.7 psi; planned Moon Base / pressurized "
    "rovers >= 30% O2 at <= 10.2 psi; spacesuits = 100% O2 at 4.3 psi.\n"
    "- Hardware groupings: ACME (BRE, CLD Flame, E-FIELD Flames, Flame Design, s-Flame, CFI-G) used "
    "modular hardware in the Combustion Integrated Rack (CIR); FLEX, FLEX-2, and CFI burned liquid "
    "droplets in the Multi-user Droplet Combustion Apparatus (MDCA) inside CIR; BASS, BASS-II, SPICE, "
    "and SLICE used the Microgravity Science Glovebox (MSG) with the SPICE flow duct.\n"
    "- Special roles: SAME / SAME-R studied smoke/aerosol detection (shared instrument with DAFT dust "
    "study); FLEX studied suppression with CO2 and He dilution; BRE emulated solid flammability via "
    "gaseous fuels; CFI-G reached up to ~85% O2; E-FIELD Flames mimicked partial gravity via electric "
    "fields; no actual Moon (~0.16g) or Mars (~0.38g) partial-gravity data exists in PSI yet "
    "(expected from LUCI and FM2). Rocket propellants are out of scope.\n"
    "- Terrestrial applications: ISS fine-water-mist extinguishers, smoke detectors, firefighter gear."
)

RANKING_GOALS = [
    {"id": "lunar", "label": "Lunar base / pressurized rover (30%+ O₂, flammability)"},
    {"id": "modeling", "label": "Predictive flammability modeling (parameter completeness)"},
    {"id": "suppression", "label": "Fire suppression & dilution (CO₂ / He / N₂)"},
    {"id": "detection", "label": "Smoke, aerosol & dust detection"},
]
