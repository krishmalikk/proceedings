"""
Test cases for the ImmigrationLabelingAgent.

Validates that the agent correctly classifies immigration content
into the 20 sub-categories defined in the taxonomy.

USAGE:
  python -m tests.test_labeling           # Run all tests
  python -m tests.test_labeling --local   # Test locally without Agent Engine
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

from labeling_agent.agent import ImmigrationLabelingAgent
from labeling_agent.taxonomy import VALID_LABELS

load_dotenv()

# ---------------------------------------------------------------------------
# Test Cases: (description, content, expected_labels)
# At least one expected label must be present in the agent's output.
# ---------------------------------------------------------------------------

TEST_CASES = [
    (
        "H-1B cap registration",
        """# H-1B Cap Season: Registration Process

Employers must submit electronic registrations for each beneficiary during the
initial registration period. USCIS will randomly select registrations and notify
employers if selected. The H-1B cap is set at 65,000 regular cap and 20,000
master's cap. Employers must pay a $215 registration fee per beneficiary.
Selected employers must file complete H-1B petitions within the filing period.""",
        ["h1b-visa"],
    ),
    (
        "Family I-130 petition",
        """# Petition for Alien Relative (Form I-130)

Use Form I-130 to establish your relationship to a qualifying relative who wishes
to immigrate to the United States. You must be a U.S. citizen or lawful permanent
resident. Immediate relatives include spouses, unmarried children under 21, and
parents of U.S. citizens age 21 or older. Family preference categories include
F1, F2A, F2B, F3, and F4.""",
        ["family-based-immigration"],
    ),
    (
        "Asylum application process",
        """# How to Apply for Asylum

To apply for asylum in the United States, you must file Form I-589 within one year
of your arrival. You must demonstrate persecution or a well-founded fear of
persecution based on race, religion, nationality, membership in a particular social
group, or political opinion. Affirmative asylum is filed with USCIS, while defensive
asylum is raised in removal proceedings before an immigration judge.""",
        ["asylum-refugees"],
    ),
    (
        "Naturalization requirements",
        """# 10 Steps to Naturalization

Step 1: Determine if you are already a U.S. citizen.
Step 2: Determine if you are eligible for naturalization.
Step 3: Prepare your Form N-400.
Step 4: Submit your Form N-400.
Step 5: Go to biometrics appointment.
Step 6: Complete the interview.
Step 7: Receive a decision.
Step 8: Receive a notice to take the Oath of Allegiance.
Step 9: Take the Oath of Allegiance.
Step 10: Understand your rights and responsibilities as a citizen.

You must have been a lawful permanent resident for at least 5 years (3 years if
married to a U.S. citizen) and be at least 18 years old.""",
        ["naturalization-citizenship"],
    ),
    (
        "DACA renewal",
        """# Renewing Your DACA

If you currently have DACA, you may request a renewal. Submit your renewal request
approximately 150 days before your current period of deferred action expires.
You will need to submit Form I-821D, Form I-765, and Form I-765WS along with the
required fees. Renewal grants deferred action and employment authorization for
two years.""",
        ["daca"],
    ),
    (
        "EB-5 investment",
        """# EB-5 Immigrant Investor Program

The EB-5 program allows immigrant investors to obtain a Green Card by investing
in a new commercial enterprise that creates at least 10 full-time jobs. The minimum
investment amount is $1,050,000, or $800,000 if the investment is in a Targeted
Employment Area (TEA). Investors may invest directly or through a USCIS-designated
regional center.""",
        ["eb5-investor-visa"],
    ),
    (
        "STEM OPT extension",
        """# STEM OPT Extension

F-1 students who have earned a degree in a STEM field may apply for a 24-month
extension of their post-completion OPT. The employer must be enrolled in E-Verify.
Students must submit Form I-765 with the STEM OPT extension fee. The I-983
Training Plan must be completed by both the student and employer. Automatic
cap-gap extension applies for students with pending H-1B petitions.""",
        ["student-visas", "work-authorization"],
    ),
    (
        "L-1B intracompany transfer",
        """# L-1B Intracompany Transferee: Specialized Knowledge

The L-1B visa allows a U.S. employer to transfer a professional employee with
specialized knowledge from an affiliated foreign office to a U.S. office. The
employee must have worked for the foreign company for at least one continuous year
within the three years preceding the petition. Initial stay is up to 3 years,
with extensions up to a maximum of 5 years.""",
        ["temporary-work-visas"],
    ),
    (
        "Diversity visa lottery",
        """# Diversity Visa Program (DV Lottery)

The Diversity Immigrant Visa Program makes up to 55,000 immigrant visas available
annually through a random selection. To qualify, you must be a native of a country
with historically low rates of immigration to the U.S. and have at least a high
school education or two years of qualifying work experience. Registration is free
and occurs during the annual registration period, typically October-November.""",
        ["diversity-visa-lottery"],
    ),
    (
        "Removal proceedings",
        """# Removal Proceedings and Deportation Defense

If you are placed in removal proceedings, you will receive a Notice to Appear (NTA)
before an immigration judge at the Executive Office for Immigration Review (EOIR).
You may be eligible for relief including cancellation of removal, asylum, voluntary
departure, or adjustment of status. You have the right to be represented by an
attorney at no expense to the government. Appeals go to the Board of Immigration
Appeals (BIA).""",
        ["deportation-defense", "immigration-court"],
    ),
    (
        "TPS re-registration",
        """# Temporary Protected Status (TPS) Re-Registration

DHS has extended TPS for designated countries. Current TPS holders must re-register
during the announced registration period to maintain their status. File Form I-821
and Form I-765 if you want to renew your Employment Authorization Document (EAD).
Your TPS-based EAD is automatically extended through the new expiration date.""",
        ["tps"],
    ),
    (
        "USCIS fee schedule",
        """# USCIS Fee Schedule

Effective April 1, 2024, USCIS has updated its fee schedule. Key fee changes:
- I-130: $535 (online) / $625 (paper)
- I-485: $1,440 (includes biometrics)
- N-400: $710 (online) / $760 (paper)
- I-765: $0 when filed with I-485
- Premium Processing I-907: $2,805
Fee waivers are available for certain applicants using Form I-912.""",
        ["visa-fees-filing"],
    ),
    (
        "Consular interview preparation",
        """# Preparing for Your Immigrant Visa Interview

After the National Visa Center (NVC) processes your case, you will be scheduled
for an interview at a U.S. Embassy or Consulate. Bring your appointment letter,
DS-260 confirmation page, civil documents, financial support evidence (I-864),
medical examination results, passport photos, and passport valid for at least 6
months. If approved, the consular officer will issue your immigrant visa.""",
        ["consular-processing"],
    ),
    (
        "I-485 concurrent filing",
        """# Adjustment of Status: Concurrent Filing

When a visa number is immediately available, you may concurrently file Form I-485
(Adjustment of Status) with your underlying petition (I-140 or I-130). Benefits
of concurrent filing include the ability to apply for an Employment Authorization
Document (I-765) and Advance Parole (I-131) while your case is pending. Your
interview may be waived if you meet certain criteria.""",
        ["adjustment-of-status"],
    ),
    (
        "Advance parole",
        """# Advance Parole Travel Document

If you have a pending Form I-485, you may apply for advance parole using Form I-131
to travel internationally and return to the United States. Without advance parole,
departing the U.S. may result in abandonment of your pending application. Processing
times vary. Combo cards (I-765/I-131) provide both work authorization and travel
document in a single card.""",
        ["travel-documents"],
    ),
]


def run_tests(agent: ImmigrationLabelingAgent, verbose: bool = True) -> dict:
    """Run all test cases and return results."""
    import time

    passed = 0
    failed = 0
    results = []

    for i, (name, content, expected_labels) in enumerate(TEST_CASES, 1):
        # Rate limit: wait between API calls
        if i > 1:
            time.sleep(4)

        result = agent.query(content=content)
        predicted = result.get("labels", [])
        confidence = result.get("confidence", 0)

        # Check if at least one expected label is present
        matches = [l for l in expected_labels if l in predicted]
        success = len(matches) > 0

        # Check for obviously wrong labels (no overlap at all)
        if success:
            passed += 1
        else:
            failed += 1

        if verbose:
            status = "PASS" if success else "FAIL"
            print(f"  [{status}] Test {i}: {name}")
            print(f"         Expected: {expected_labels}")
            print(f"         Got:      {predicted} (confidence: {confidence:.2f})")
            if not success:
                print(f"         ** No expected labels found in prediction **")
            print()

        results.append({
            "name": name,
            "expected": expected_labels,
            "predicted": predicted,
            "confidence": confidence,
            "passed": success,
        })

    return {
        "total": len(TEST_CASES),
        "passed": passed,
        "failed": failed,
        "accuracy": passed / len(TEST_CASES) if TEST_CASES else 0,
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Test the immigration labeling agent")
    parser.add_argument("--local", action="store_true",
                        help="Test locally (default, no Agent Engine needed)")
    args = parser.parse_args()

    project_id = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
    region = os.getenv("GCP_REGION", "us-central1")

    print("=" * 50)
    print("Immigration Labeling Agent — Test Suite")
    print("=" * 50)
    print(f"Testing with {len(TEST_CASES)} test cases\n")

    agent = ImmigrationLabelingAgent(
        model="gemini-2.5-flash",
        project=project_id,
        location=region,
    )
    agent.set_up()

    summary = run_tests(agent)

    print("=" * 50)
    print(f"RESULTS: {summary['passed']}/{summary['total']} passed ({summary['accuracy']:.0%} accuracy)")
    if summary["failed"] > 0:
        print(f"  {summary['failed']} tests failed")
    print("=" * 50)

    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
