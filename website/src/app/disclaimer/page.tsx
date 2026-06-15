import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal Disclaimer',
  description:
    'usajourney.ai provides general immigration information and a community platform only. It is not a law firm and does not provide legal advice.',
}

const LAST_UPDATED = 'June 14, 2026'

// Standalone legal disclaimer. Plain, sectioned content — no client state.
// NOTE: this is standard boilerplate and should be reviewed by counsel before
// public launch.
export default function DisclaimerPage() {
  return (
    <div className="container-narrow section-padding-sm">
      <div className="max-w-3xl mx-auto">
        <p className="overline mb-2">Legal</p>
        <h1 className="text-headline-lg text-on-surface mb-1">Legal Disclaimer</h1>
        <p className="text-caption text-on-surface-variant mb-6">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-6 text-body-md text-on-surface-variant leading-relaxed">
          <p className="text-body-md text-on-surface">
            Please read this disclaimer carefully before using usajourney.ai (the
            &ldquo;Site,&rdquo; &ldquo;App,&rdquo; or &ldquo;Service&rdquo;). By accessing or using
            the Service, you acknowledge that you have read, understood, and agree to be bound by
            this disclaimer. If you do not agree, do not use the Service.
          </p>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">1. No Legal Advice</h2>
            <p>
              The information provided on or through the Service — including articles, search
              results, AI-generated responses, tags, summaries, and any content posted by users — is
              provided for general informational purposes only and does <strong>not</strong>{' '}
              constitute legal advice. Nothing on the Service is intended to be, and should not be
              relied upon as, a substitute for advice from a licensed attorney regarding your
              specific situation. Any message, response, opinion, suggestion, or &ldquo;advice&rdquo;
              posted, generated, or shared through the Service does not constitute legal advice and
              must not be treated as such.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">2. No Attorney–Client Relationship</h2>
            <p>
              Use of the Service does not create an attorney–client relationship between you and
              usajourney.ai, its owners, operators, employees, contributors, or any other user.
              Communications made through the Service are not protected by the attorney–client
              privilege or any other privilege, and are not confidential. Do not send or post
              sensitive, privileged, or personally identifying information through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">3. User-Generated Content</h2>
            <p>
              The Service includes content created by other users, such as postings, replies,
              group messages, and shared experiences. This content reflects the personal views and
              experiences of the individuals who posted it. usajourney.ai does not author, verify,
              endorse, or guarantee the accuracy, completeness, or reliability of any user-generated
              content. Other users are not attorneys acting on your behalf, and any guidance they
              offer is peer commentary — not legal advice. You rely on user-generated content at
              your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">4. AI-Generated Information</h2>
            <p>
              Certain features of the Service use automated and artificial-intelligence systems to
              generate responses or summaries. These outputs may be incomplete, outdated, or
              incorrect, and may not reflect current law or your specific circumstances.
              AI-generated information is provided for general informational purposes only, does not
              constitute legal advice, and should be independently verified with a qualified
              attorney before you act on it.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">5. Not a Law Firm or Government Agency</h2>
            <p>
              usajourney.ai is not a law firm, is not a substitute for an attorney or law firm, and
              does not practice law. usajourney.ai is not affiliated with, endorsed by, or acting on
              behalf of U.S. Citizenship and Immigration Services (USCIS), the U.S. Department of
              State, any court, or any other government agency. Official information should always
              be confirmed with the relevant government source.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">6. No Warranty; Accuracy Not Guaranteed</h2>
            <p>
              Immigration law and government procedures change frequently and vary by individual
              circumstances and jurisdiction. The Service is provided on an &ldquo;as is&rdquo; and
              &ldquo;as available&rdquo; basis without warranties of any kind, whether express or
              implied, including but not limited to warranties of accuracy, completeness,
              timeliness, fitness for a particular purpose, or non-infringement. We do not warrant
              that the information on the Service is current, correct, or applicable to your
              situation.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">7. No Endorsement of Third Parties</h2>
            <p>
              Any reference to, or listing of, attorneys, consultants, professionals, organizations,
              or external resources is provided for convenience only and does not constitute an
              endorsement, recommendation, or guarantee of any third party or their services. You
              are solely responsible for evaluating and selecting any professional you choose to
              engage.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, usajourney.ai and its owners, operators,
              employees, and contributors shall not be liable for any loss, damage, or harm of any
              kind arising out of or in connection with your use of, or reliance on, the Service or
              any content provided through it. Your use of the Service is entirely at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">9. Consult a Licensed Attorney</h2>
            <p>
              For advice about your specific immigration matter, you should consult a licensed
              immigration attorney admitted to practice in the relevant jurisdiction. Do not delay
              seeking professional legal advice, or disregard such advice, because of anything you
              have read or received through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-headline-md text-on-surface mb-2">10. Changes to This Disclaimer</h2>
            <p>
              We may update this disclaimer from time to time. Any changes will be effective upon
              posting to this page, with the &ldquo;Last updated&rdquo; date revised accordingly.
              Your continued use of the Service after changes are posted constitutes your acceptance
              of the revised disclaimer.
            </p>
          </section>

          <div className="divider pt-6">
            <p className="text-caption text-on-surface-variant">
              Questions about this disclaimer? Contact us at{' '}
              <a href="mailto:support@usajourney.ai" className="text-primary hover:underline">
                support@usajourney.ai
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
