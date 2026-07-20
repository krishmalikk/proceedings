import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Krishes Inc (meridianjourney.ai) and the Meridian Journey app collect, use, share, and protect your information.',
}

const LAST_UPDATED = 'June 16, 2026'

// Content transcribed from the company's Privacy Notice (Termly HTML export).
// Editor markup, inline styles, and conditional editor blocks are stripped;
// only the real policy text/headings/lists are rendered.

type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

const BLOCKS: Block[] = [
  {
    "type": "p",
    "text": "This Privacy Notice for Krishes Inc (\"we,\" \"us,\" or \"our\"), describes how and why we might access, collect, store, use, and/or share (\"process\") your personal information when you use our services (\"Services\"), including when you:"
  },
  {
    "type": "ul",
    "items": [
      "Visit our website at https://www.meridianjourney.ai or any website of ours that links to this Privacy Notice",
      "Download and use our mobile application (Meridian Journey), or any other application of ours that links to this Privacy Notice",
      "Use Get Help and support in process of getting Non-immigration or immigration process to United States. . Get Help and support in process of getting Non-immigration or immigration process to United States.",
      "Engage with us in other related ways, including any marketing or events"
    ]
  },
  {
    "type": "p",
    "text": "Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at krishesinc@gmail.com."
  },
  {
    "type": "h2",
    "text": "SUMMARY OF KEY POINTS"
  },
  {
    "type": "p",
    "text": "This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for."
  },
  {
    "type": "p",
    "text": "What personal information do we process? When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about personal information you disclose to us."
  },
  {
    "type": "p",
    "text": "Do we process any sensitive personal information? Some of the information may be considered \"special\" or \"sensitive\" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information."
  },
  {
    "type": "p",
    "text": "Do we collect any information from third parties? We do not collect any information from third parties."
  },
  {
    "type": "p",
    "text": "How do we process your information? We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information."
  },
  {
    "type": "p",
    "text": "In what situations and with which parties do we share personal information? We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information."
  },
  {
    "type": "p",
    "text": "How do we keep your information safe? We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your information safe."
  },
  {
    "type": "p",
    "text": "What are your rights? Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights."
  },
  {
    "type": "p",
    "text": "How do you exercise your rights? The easiest way to exercise your rights is by visiting meridianjourney.ai/datarequest, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws."
  },
  {
    "type": "p",
    "text": "Want to learn more about what we do with any information we collect? Review the Privacy Notice in full."
  },
  {
    "type": "h2",
    "text": "TABLE OF CONTENTS"
  },
  {
    "type": "p",
    "text": "1. WHAT INFORMATION DO WE COLLECT?"
  },
  {
    "type": "p",
    "text": "2. HOW DO WE PROCESS YOUR INFORMATION?"
  },
  {
    "type": "p",
    "text": "3. WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR PERSONAL INFORMATION?"
  },
  {
    "type": "p",
    "text": "4. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?"
  },
  {
    "type": "p",
    "text": "5. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?"
  },
  {
    "type": "p",
    "text": "6. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?"
  },
  {
    "type": "p",
    "text": "7. HOW DO WE HANDLE YOUR SOCIAL LOGINS?"
  },
  {
    "type": "p",
    "text": "8. HOW LONG DO WE KEEP YOUR INFORMATION?"
  },
  {
    "type": "p",
    "text": "9. HOW DO WE KEEP YOUR INFORMATION SAFE?"
  },
  {
    "type": "p",
    "text": "10. DO WE COLLECT INFORMATION FROM MINORS?"
  },
  {
    "type": "p",
    "text": "11. WHAT ARE YOUR PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "12. CONTROLS FOR DO-NOT-TRACK FEATURES"
  },
  {
    "type": "p",
    "text": "13. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "14. DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "15. DO WE MAKE UPDATES TO THIS NOTICE?"
  },
  {
    "type": "p",
    "text": "16. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?"
  },
  {
    "type": "p",
    "text": "17. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?"
  },
  {
    "type": "h2",
    "text": "1. WHAT INFORMATION DO WE COLLECT?"
  },
  {
    "type": "h3",
    "text": "Personal information you disclose to us"
  },
  {
    "type": "p",
    "text": "In Short: We collect personal information that you provide to us."
  },
  {
    "type": "p",
    "text": "We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us."
  },
  {
    "type": "p",
    "text": "Sensitive Information. To operate the Service, we process the information you choose to provide about your immigration situation — such as visa type or category, consulate, key dates, and the background and questions you enter. Where required, we do so with your consent. This information, along with the questions you submit to our AI features, is shared with our third-party AI service provider (Google's Gemini / Google Cloud AI) to generate responses and structure onboarding, as described in \"DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?\" below. You are asked for permission in the app before any data is sent to the AI service, and you can disable AI features at any time in the app's Profile settings."
  },
  {
    "type": "p",
    "text": "Social Media Login Data. We may provide you with the option to register with us using your existing social media account details, like your Facebook, X, or other social media account. If you choose to register in this way, we will collect certain profile information about you from the social media provider, as described in the section called \"HOW DO WE HANDLE YOUR SOCIAL LOGINS?\" below."
  },
  {
    "type": "p",
    "text": "Application Data. If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:"
  },
  {
    "type": "ul",
    "items": [
      "Geolocation Information. We may request access or permission to track location-based information from your mobile device, either continuously or while you are using our mobile application(s), to provide certain location-based services. If you wish to change our access or permissions, you may do so in your device's settings.",
      "Push Notifications. We may request to send you push notifications regarding your account or certain features of the application(s). If you wish to opt out from receiving these types of communications, you may turn them off in your device's settings."
    ]
  },
  {
    "type": "p",
    "text": "This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes."
  },
  {
    "type": "p",
    "text": "All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information."
  },
  {
    "type": "h3",
    "text": "Google API"
  },
  {
    "type": "p",
    "text": "Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements."
  },
  {
    "type": "h2",
    "text": "2. HOW DO WE PROCESS YOUR INFORMATION?"
  },
  {
    "type": "p",
    "text": "In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We process the personal information for the following purposes listed below. We may also process your information for other purposes only with your prior explicit consent."
  },
  {
    "type": "p",
    "text": "We process your personal information for a variety of reasons, depending on how you interact with our Services, including:"
  },
  {
    "type": "ul",
    "items": [
      "To facilitate account creation and authentication and otherwise manage user accounts. We may process your information so you can create and log in to your account, as well as keep your account in working order.",
      "To save or protect an individual's vital interest. We may process your information when necessary to save or protect an individual’s vital interest, such as to prevent harm."
    ]
  },
  {
    "type": "h2",
    "text": "3. WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR INFORMATION?"
  },
  {
    "type": "p",
    "text": "In Short: We only process your personal information when we believe it is necessary and we have a valid legal reason (i.e., legal basis) to do so under applicable law, like with your consent, to comply with laws, to provide you with services to enter into or fulfill our contractual obligations, to protect your rights, or to fulfill our legitimate business interests."
  },
  {
    "type": "p",
    "text": "If you are located in the EU or UK, this section applies to you."
  },
  {
    "type": "p",
    "text": "The General Data Protection Regulation (GDPR) and UK GDPR require us to explain the valid legal bases we rely on in order to process your personal information. As such, we may rely on the following legal bases to process your personal information:"
  },
  {
    "type": "ul",
    "items": [
      "Consent. We may process your information if you have given us permission (i.e., consent) to use your personal information for a specific purpose. You can withdraw your consent at any time. Learn more about withdrawing your consent.",
      "Legal Obligations. We may process your information where we believe it is necessary for compliance with our legal obligations, such as to cooperate with a law enforcement body or regulatory agency, exercise or defend our legal rights, or disclose your information as evidence in litigation in which we are involved.",
      "Vital Interests. We may process your information where we believe it is necessary to protect your vital interests or the vital interests of a third party, such as situations involving potential threats to the safety of any person."
    ]
  },
  {
    "type": "p",
    "text": "If you are located in Canada, this section applies to you."
  },
  {
    "type": "p",
    "text": "We may process your information if you have given us specific permission (i.e., express consent) to use your personal information for a specific purpose, or in situations where your permission can be inferred (i.e., implied consent). You can withdraw your consent at any time."
  },
  {
    "type": "p",
    "text": "In some exceptional cases, we may be legally permitted under applicable law to process your information without your consent, including, for example:"
  },
  {
    "type": "ul",
    "items": [
      "If collection is clearly in the interests of an individual and consent cannot be obtained in a timely way",
      "For investigations and fraud detection and prevention",
      "For business transactions provided certain conditions are met",
      "If it is contained in a witness statement and the collection is necessary to assess, process, or settle an insurance claim",
      "For identifying injured, ill, or deceased persons and communicating with next of kin",
      "If we have reasonable grounds to believe an individual has been, is, or may be victim of financial abuse",
      "If it is reasonable to expect collection and use with consent would compromise the availability or the accuracy of the information and the collection is reasonable for purposes related to investigating a breach of an agreement or a contravention of the laws of Canada or a province",
      "If disclosure is required to comply with a subpoena, warrant, court order, or rules of the court relating to the production of records",
      "If it was produced by an individual in the course of their employment, business, or profession and the collection is consistent with the purposes for which the information was produced",
      "If the collection is solely for journalistic, artistic, or literary purposes",
      "If the information is publicly available and is specified by the regulations",
      "We may disclose de-identified information for approved research or statistics projects, subject to ethics oversight and confidentiality commitments"
    ]
  },
  {
    "type": "h2",
    "text": "4. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?"
  },
  {
    "type": "p",
    "text": "In Short: We may share information in specific situations described in this section and/or with the following third parties."
  },
  {
    "type": "p",
    "text": "We may need to share your personal information in the following situations:"
  },
  {
    "type": "ul",
    "items": [
      "Business Transfers. We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company."
    ]
  },
  {
    "type": "h2",
    "text": "5. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?"
  },
  {
    "type": "p",
    "text": "In Short: We may use cookies and other tracking technologies to collect and store your information."
  },
  {
    "type": "p",
    "text": "We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions."
  },
  {
    "type": "p",
    "text": "We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements, to tailor advertisements to your interests, or to send abandoned shopping cart reminders (depending on your communication preferences). The third parties and service providers use their technology to provide advertising about products and services tailored to your interests which may appear either on our Services or on other websites."
  },
  {
    "type": "p",
    "text": "To the extent these online tracking technologies are deemed to be a \"sale\"/\"sharing\" (which includes targeted advertising, as defined under the applicable laws) under applicable US state laws, you can opt out of these online tracking technologies by submitting a request as described below under section \"DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?\""
  },
  {
    "type": "p",
    "text": "Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice: meridianjourney.ai."
  },
  {
    "type": "h2",
    "text": "6. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?"
  },
  {
    "type": "p",
    "text": "In Short: We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies."
  },
  {
    "type": "p",
    "text": "As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (collectively, \"AI Products\"). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services."
  },
  {
    "type": "p",
    "text": "Use of AI Technologies"
  },
  {
    "type": "p",
    "text": "We provide the AI Products through third-party service providers (\"AI Service Providers\"), specifically Google's Gemini models (Google Cloud AI). The data shared with the AI Service Provider is the text you enter into AI features — your questions and the profile details you provide, such as visa type or category, consulate, key dates, and background. Your input, the generated output, and this personal information are shared with and processed by the AI Service Provider solely to generate responses and structure your onboarding, for the purposes outlined in \"WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR PERSONAL INFORMATION?\" We ask for your permission in the app before any data is sent to the AI Service Provider, and you can decline or later disable AI features in the app's Profile settings without sending any data. You must not use the AI Products in any way that violates the terms or policies of any AI Service Provider."
  },
  {
    "type": "p",
    "text": "Our AI Products"
  },
  {
    "type": "p",
    "text": "Our AI Products are designed for the following functions:"
  },
  {
    "type": "ul",
    "items": [
      "AI search",
      "AI applications"
    ]
  },
  {
    "type": "p",
    "text": "How We Process Your Data Using AI"
  },
  {
    "type": "p",
    "text": "All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data's safety."
  },
  {
    "type": "p",
    "text": "How to Opt Out"
  },
  {
    "type": "p",
    "text": "We believe in giving you the power to decide how your data is used. To opt out, you can:"
  },
  {
    "type": "ul",
    "items": [
      "Log in to your account settings and update your user account",
      "Contact us using the contact information provided"
    ]
  },
  {
    "type": "h2",
    "text": "7. HOW DO WE HANDLE YOUR SOCIAL LOGINS?"
  },
  {
    "type": "p",
    "text": "In Short: If you choose to register or log in to our Services using a social media account, we may have access to certain information about you."
  },
  {
    "type": "p",
    "text": "Our Services offer you the ability to register and log in using your third-party social media account details (like your Facebook or X logins). Where you choose to do this, we will receive certain profile information about you from your social media provider. The profile information we receive may vary depending on the social media provider concerned, but will often include your name, email address, friends list, and profile picture, as well as other information you choose to make public on such a social media platform."
  },
  {
    "type": "p",
    "text": "We will use the information we receive only for the purposes that are described in this Privacy Notice or that are otherwise made clear to you on the relevant Services. Please note that we do not control, and are not responsible for, other uses of your personal information by your third-party social media provider. We recommend that you review their privacy notice to understand how they collect, use, and share your personal information, and how you can set your privacy preferences on their sites and apps."
  },
  {
    "type": "h2",
    "text": "8. HOW LONG DO WE KEEP YOUR INFORMATION?"
  },
  {
    "type": "p",
    "text": "In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law."
  },
  {
    "type": "p",
    "text": "We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than three (3) months past the termination of the user's account."
  },
  {
    "type": "p",
    "text": "When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible."
  },
  {
    "type": "h2",
    "text": "9. HOW DO WE KEEP YOUR INFORMATION SAFE?"
  },
  {
    "type": "p",
    "text": "In Short: We aim to protect your personal information through a system of organizational and technical security measures."
  },
  {
    "type": "p",
    "text": "We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment."
  },
  {
    "type": "h2",
    "text": "10. DO WE COLLECT INFORMATION FROM MINORS?"
  },
  {
    "type": "p",
    "text": "In Short: We do not knowingly collect data from or market to children under 18 years of age or the equivalent age as specified by law in your jurisdiction."
  },
  {
    "type": "p",
    "text": "We do not knowingly collect, solicit data from, or market to children under 18 years of age or the equivalent age as specified by law in your jurisdiction, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or the equivalent age as specified by law in your jurisdiction or that you are the parent or guardian of such a minor and consent to such minor dependent’s use of the Services. If we learn that personal information from users less than 18 years of age or the equivalent age as specified by law in your jurisdiction has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18 or the equivalent age as specified by law in your jurisdiction, please contact us at dpo@meridianjourney.ai."
  },
  {
    "type": "h2",
    "text": "11. WHAT ARE YOUR PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "In Short: Depending on your state of residence in the US or in some regions, such as the European Economic Area (EEA), United Kingdom (UK), Switzerland, and Canada, you have rights that allow you greater access to and control over your personal information. You may review, change, or terminate your account at any time, depending on your country, province, or state of residence."
  },
  {
    "type": "p",
    "text": "In some regions (like the EEA, UK, Switzerland, and Canada), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; (iv) if applicable, to data portability; and (v) not to be subject to automated decision-making. If a decision that produces legal or similarly significant effects is made solely by automated means, we will inform you, explain the main factors, and offer a simple way to request human review. In certain circumstances, you may also have the right to object to the processing of your personal information. You can make such a request by contacting us by using the contact details provided in the section \"HOW CAN YOU CONTACT US ABOUT THIS NOTICE?\" below."
  },
  {
    "type": "p",
    "text": "We will consider and act upon any request in accordance with applicable data protection laws."
  },
  {
    "type": "p",
    "text": "If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your Member State data protection authority or UK data protection authority."
  },
  {
    "type": "p",
    "text": "If you are located in Switzerland, you may contact the Federal Data Protection and Information Commissioner."
  },
  {
    "type": "p",
    "text": "Withdrawing your consent: If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section \"HOW CAN YOU CONTACT US ABOUT THIS NOTICE?\" below or updating your preferences."
  },
  {
    "type": "p",
    "text": "However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent."
  },
  {
    "type": "h3",
    "text": "Account Information"
  },
  {
    "type": "p",
    "text": "If you would at any time like to review or change the information in your account or terminate your account, you can:"
  },
  {
    "type": "ul",
    "items": [
      "Log in to your account settings and update your user account.",
      "Contact us using the contact information provided."
    ]
  },
  {
    "type": "p",
    "text": "Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements."
  },
  {
    "type": "p",
    "text": "Cookies and similar technologies: Most Web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove cookies and to reject cookies. If you choose to remove cookies or reject cookies, this could affect certain features or services of our Services. For further information, please see our Cookie Notice: meridianjourney.ai."
  },
  {
    "type": "p",
    "text": "If you have questions or comments about your privacy rights, you may email us at krishesinc@gmail.com."
  },
  {
    "type": "h2",
    "text": "12. CONTROLS FOR DO-NOT-TRACK FEATURES"
  },
  {
    "type": "p",
    "text": "Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (\"DNT\") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice."
  },
  {
    "type": "p",
    "text": "California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time."
  },
  {
    "type": "h2",
    "text": "13. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "In Short: If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. More information is provided below."
  },
  {
    "type": "h3",
    "text": "Categories of Personal Information We Collect"
  },
  {
    "type": "p",
    "text": "The table below shows the categories of personal information we have collected in the past twelve (12) months. The table includes illustrative examples of each category and does not reflect the personal information we collect from you. For a comprehensive inventory of all personal information we process, please refer to the section \"WHAT INFORMATION DO WE COLLECT?\""
  },
  {
    "type": "p",
    "text": "CategoryExamplesCollected"
  },
  {
    "type": "p",
    "text": "A. Identifiers"
  },
  {
    "type": "p",
    "text": "Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "B. Personal information as defined in the California Customer Records statute"
  },
  {
    "type": "p",
    "text": "Name, contact information, education, employment, employment history, and financial information"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "C. Protected classification characteristics under state or federal law"
  },
  {
    "type": "p",
    "text": "Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "D. Commercial information"
  },
  {
    "type": "p",
    "text": "Transaction information, purchase history, financial details, and payment information"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "E. Biometric information"
  },
  {
    "type": "p",
    "text": "Fingerprints and voiceprints"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "F. Internet or other similar network activity"
  },
  {
    "type": "p",
    "text": "Browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "G. Geolocation data"
  },
  {
    "type": "p",
    "text": "Device location"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "H. Audio, electronic, sensory, or similar information"
  },
  {
    "type": "p",
    "text": "Images and audio, video or call recordings created in connection with our business activities"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "I. Professional or employment-related information"
  },
  {
    "type": "p",
    "text": "Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "J. Education Information"
  },
  {
    "type": "p",
    "text": "Student records and directory information"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "K. Inferences drawn from collected personal information"
  },
  {
    "type": "p",
    "text": "Inferences drawn from any of the collected personal information listed above to create a profile or summary about, for example, an individual’s preferences and characteristics"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "L. Sensitive personal Information"
  },
  {
    "type": "p",
    "text": "NO"
  },
  {
    "type": "p",
    "text": "We may also collect other personal information outside of these categories through instances where you interact with us in person, online, or by phone or mail in the context of:"
  },
  {
    "type": "ul",
    "items": [
      "Receiving help through our customer support channels;",
      "Participation in customer surveys or contests; and",
      "Facilitation in the delivery of our Services and to respond to your inquiries."
    ]
  },
  {
    "type": "h3",
    "text": "Sources of Personal Information"
  },
  {
    "type": "p",
    "text": "Learn more about the sources of personal information we collect in \"WHAT INFORMATION DO WE COLLECT?\""
  },
  {
    "type": "h3",
    "text": "How We Use and Share Personal Information"
  },
  {
    "type": "p",
    "text": "Learn more about how we use your personal information in the section, \"HOW DO WE PROCESS YOUR INFORMATION?\""
  },
  {
    "type": "p",
    "text": "Will your information be shared with anyone else?"
  },
  {
    "type": "p",
    "text": "We may disclose your personal information with our service providers pursuant to a written contract between us and each service provider. Learn more about how we disclose personal information to in the section, \"WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?\""
  },
  {
    "type": "p",
    "text": "We may use your personal information for our own business purposes, such as for undertaking internal research for technological development and demonstration. This is not considered to be \"selling\" of your personal information."
  },
  {
    "type": "p",
    "text": "We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (12) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers."
  },
  {
    "type": "h3",
    "text": "Your Rights"
  },
  {
    "type": "p",
    "text": "You have rights under certain US state data protection laws. However, these rights are not absolute, and in certain cases, we may decline your request as permitted by law. These rights include:"
  },
  {
    "type": "ul",
    "items": [
      "Right to know whether or not we are processing your personal data",
      "Right to access your personal data",
      "Right to correct inaccuracies in your personal data",
      "Right to request the deletion of your personal data",
      "Right to obtain a copy of the personal data you previously shared with us",
      "Right to non-discrimination for exercising your rights",
      "Right to opt out of the processing of your personal data if it is used for targeted advertising (or sharing as defined under California’s privacy law), the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects (\"profiling\")"
    ]
  },
  {
    "type": "p",
    "text": "Depending upon the state where you live, you may also have the following rights:"
  },
  {
    "type": "ul",
    "items": [
      "Right to access the categories of personal data being processed (as permitted by applicable law, including the privacy law in Minnesota)",
      "Right to obtain a list of the categories of third parties to which we have disclosed personal data (as permitted by applicable law, including the privacy law in California, Delaware, and Maryland)",
      "Right to obtain a list of specific third parties to which we have disclosed personal data (as permitted by applicable law, including the privacy law in Minnesota and Oregon)",
      "Right to obtain a list of third parties to which we have sold personal data (as permitted by applicable law, including the privacy law in Connecticut)",
      "Right to review, understand, question, and depending on where you live, correct how personal data has been profiled (as permitted by applicable law, including the privacy law in Connecticut and Minnesota)",
      "Right to limit use and disclosure of sensitive personal data (as permitted by applicable law, including the privacy law in California)",
      "Right to opt out of the collection of sensitive data and personal data collected through the operation of a voice or facial recognition feature (as permitted by applicable law, including the privacy law in Florida)"
    ]
  },
  {
    "type": "h3",
    "text": "How to Exercise Your Rights"
  },
  {
    "type": "p",
    "text": "To exercise these rights, you can contact us by visiting meridianjourney.ai/datarequest, by emailing us at support@meridianjourney.ai, by visiting meridianjourney.ai/support, or by referring to the contact details at the bottom of this document."
  },
  {
    "type": "p",
    "text": "Under certain US state data protection laws, you can designate an authorized agent to make a request on your behalf. We may deny a request from an authorized agent that does not submit proof that they have been validly authorized to act on your behalf in accordance with applicable laws."
  },
  {
    "type": "h3",
    "text": "Request Verification"
  },
  {
    "type": "p",
    "text": "Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request. However, if we cannot verify your identity from the information already maintained by us, we may request that you provide additional information for the purposes of verifying your identity and for security or fraud-prevention purposes."
  },
  {
    "type": "p",
    "text": "If you submit the request through an authorized agent, we may need to collect additional information to verify your identity before processing your request and the agent will need to provide a written and signed permission from you to submit such request on your behalf."
  },
  {
    "type": "h3",
    "text": "Appeals"
  },
  {
    "type": "p",
    "text": "Under certain US state data protection laws, if we decline to take action regarding your request, you may appeal our decision by emailing us at krishesinc@gmail.com. We will inform you in writing of any action taken or not taken in response to the appeal, including a written explanation of the reasons for the decisions. If your appeal is denied, you may submit a complaint to your state attorney general."
  },
  {
    "type": "h3",
    "text": "California \"Shine The Light\" Law"
  },
  {
    "type": "p",
    "text": "California Civil Code Section 1798.83, also known as the \"Shine The Light\" law, permits our users who are California residents to request and obtain from us, once a year and free of charge, information about categories of personal information (if any) we disclosed to third parties for direct marketing purposes and the names and addresses of all third parties with which we shared personal information in the immediately preceding calendar year. If you are a California resident and would like to make such a request, please submit your request in writing to us by using the contact details provided in the section \"HOW CAN YOU CONTACT US ABOUT THIS NOTICE?\""
  },
  {
    "type": "h2",
    "text": "14. DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?"
  },
  {
    "type": "p",
    "text": "In Short: You may have additional rights based on the country you reside in."
  },
  {
    "type": "h3",
    "text": "Australia and New Zealand"
  },
  {
    "type": "p",
    "text": "We collect and process your personal information under the obligations and conditions set by Australia's Privacy Act 1988 and New Zealand's Privacy Act 2020 (Privacy Act)."
  },
  {
    "type": "p",
    "text": "This Privacy Notice satisfies the notice requirements defined in both Privacy Acts, in particular: what personal information we collect from you, from which sources, for which purposes, and other recipients of your personal information."
  },
  {
    "type": "p",
    "text": "If you do not wish to provide the personal information necessary to fulfill their applicable purpose, it may affect our ability to provide our services, in particular:"
  },
  {
    "type": "ul",
    "items": [
      "offer you the products or services that you want",
      "respond to or help with your requests",
      "manage your account with us",
      "confirm your identity and protect your account"
    ]
  },
  {
    "type": "p",
    "text": "At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section \"HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?\""
  },
  {
    "type": "p",
    "text": "If you believe we are unlawfully processing your personal information, you have the right to submit a complaint about a breach of the Australian Privacy Principles to the Office of the Australian Information Commissioner and a breach of New Zealand's Privacy Principles to the Office of New Zealand Privacy Commissioner."
  },
  {
    "type": "h3",
    "text": "Republic of South Africa"
  },
  {
    "type": "p",
    "text": "At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section \"HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?\""
  },
  {
    "type": "p",
    "text": "If you are unsatisfied with the manner in which we address any complaint with regard to our processing of personal information, you can contact the office of the regulator, the details of which are:"
  },
  {
    "type": "p",
    "text": "The Information Regulator (South Africa)"
  },
  {
    "type": "p",
    "text": "General enquiries: enquiries@inforegulator.org.za"
  },
  {
    "type": "p",
    "text": "Complaints (complete POPIA/PAIA form 5): PAIAComplaints@inforegulator.org.za & POPIAComplaints@inforegulator.org.za"
  },
  {
    "type": "h2",
    "text": "15. DO WE MAKE UPDATES TO THIS NOTICE?"
  },
  {
    "type": "p",
    "text": "In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws."
  },
  {
    "type": "p",
    "text": "We may update this Privacy Notice from time to time. The updated version will be indicated by an updated \"Revised\" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information."
  },
  {
    "type": "h2",
    "text": "16. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?"
  },
  {
    "type": "p",
    "text": "If you have questions or comments about this notice, you may email us at dpo@meridianjourney.ai or contact us by post at:"
  },
  {
    "type": "p",
    "text": "Krishes Inc"
  },
  {
    "type": "p",
    "text": "2195 Carbondale Cir"
  },
  {
    "type": "p",
    "text": "Dublin, CA 94568"
  },
  {
    "type": "p",
    "text": "United States"
  },
  {
    "type": "h2",
    "text": "17. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?"
  },
  {
    "type": "p",
    "text": "Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit: meridianjourney.ai/datarequest."
  },
  {
    "type": "p",
    "text": "This Privacy Policy was created using Termly's Privacy Policy Generator"
  }
]

export default function PrivacyPage() {
  return (
    <div className="container-narrow section-padding-sm">
      <div className="max-w-3xl mx-auto">
        <p className="overline mb-2">Legal</p>
        <h1 className="text-headline-lg text-on-surface mb-1">Privacy Policy</h1>
        <p className="text-caption text-on-surface-variant mb-6">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-3 text-body-md text-on-surface-variant leading-relaxed">
          {BLOCKS.map((b, i) => {
            if (b.type === 'h2')
              return (
                <h2 key={i} className="text-headline-md text-on-surface mt-6 mb-2">
                  {b.text}
                </h2>
              )
            if (b.type === 'h3')
              return (
                <h3 key={i} className="text-on-surface font-semibold mt-4 mb-1">
                  {b.text}
                </h3>
              )
            if (b.type === 'ul')
              return (
                <ul key={i} className="list-disc pl-6 space-y-1">
                  {b.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              )
            return <p key={i}>{b.text}</p>
          })}
        </div>
      </div>
    </div>
  )
}
