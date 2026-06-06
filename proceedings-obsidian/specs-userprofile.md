# User profile 

A basic user profile is setup for a user assuming user is an applicant in the process of USA immigration or non-immigration system.
NO personal PII or PII information should be captured
The user's situation can change from time to time, so provide option to change / add to his journey in the profile


# Basic Information to be captured
The static information of the user which needs to be captured and the user's current and journey into USA immigration system
Some of the attributes to be captured here overlap with metadata as specified in [JSON-SCHEMA-FIELD-DICTIONARY](../tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) which are:
## When user already has a status in USA
- `current_visa_or_greencard_category`
## When user is applying for a visa from abroad
- `primary_consulate`
- `visa_applying_for` --if known. 
- `resident_of_country` under `key_stages_or_info`
- `citizen_of_country` under `key_stages_or_info`

There should be a free text field also in profile where can enter a text of background, intention etc. related to US immigration with no personal information


Depending upon the situation of the applicant the conversational BOT can ask relevant questions to get answers to the tags in:
- [key-stages](../tags-cleaned/1.7-key-stages.csv) -- to fill up the section under json attribute `key_stages_or_info`
- [key-dates](../tags-cleaned/1.8-key-dates.csv) -- to fill up the section under json attribute `key_dates`

Make sure every key/value pair values under `key_stages_or_info` or `key_dates` entered by user are valid tag as per rules specified in [TAGGING-EVALUATION](../tagging-specifications/TAGGING-EVALUATION.md)

## Profile setup methods
There are two ways to setup a user-profile in the app. The AI way and the traditional form-based way.

### AI way
In This method :
- the app will impersonate a US immigration expert 
- the app will converse as a bot with user to capture user's current status, situation and future intent 
- will capture the basic information as specified in section above
- Prompt user to enter dates under `key_dates`  which are relevant to his case/situation. The dates help other applicants a lot when a user is trying to find other folks who are in same boat (functionality coming next)
- Assuming the user is somewhere in the journey as specified in [f1-to-h1-gc](../app-specifications/imm-flows-example/f1-to-h1-gc.png), the BOT should ask for relevant stages and dates on his journey to capture every step, if possible
- This was just one of journeys but most common, I presume. There are other journeys as well and the questions should be relevant to the journey the user is in
- Do not force users to enter every step or every date. But more prominent dates  where most users are  likely stuck in journey and/or waiting and/or where waiting is huge, those dates matters a lot. BOT. being a immigration expert should know what those dates are. Example is priority_date, h1b_filing_date etc`
- The date entered by user may not follow the data format the system stores date. The system in backend should be able to convert into appropriate standard format for the data across, no matter what date format user has entered the date in
- Remind users from time to time that more  specific infomation they enter, more helpful it would be for  users to find each other who are in same boat ,who they can connect to here in this platform (a featue coming soon).
- capture the experience of every milestone or step in the journey. Visa interview is a huge milestone and user should be repeatedly asked to post their experience of visa interview. 
- Write some test cases so that prior experiences not relevant to current situation are not tagged at all
- From UI standpoint, make sure that user's flow of capturing background information is not interrupted and past user's experiences of various milestones/steps are captured in the end after BOT notices that user has passed certain milestones/already. These past experiences should not be asked in the middle of the flow of capturing basic information and should not be tagged.
- SImilat for every milestone like h1b approval, filing, RFE, the interaction with CBP at port-of-entry etc. Evey interaction or process we should have the ability to capture their experience and the BOT, when they know that thay have crossed certain steps or milestones then should ask the user to enter their experience or timeline. The response of these past experiences of the user may not be tagged unless it is their current situation. For example, past experience of other rejection should not be captured as current state as it not be relevant to current state. But the experiene as text should be captured in chronological fashion for every step/milestone of the journey and should be asked by BOT and stored accordingly in firestore.
- Split the profile entry into two stages:
* First part where user has asked these questions based upon journey/ state/ outcome/ dates as before with all  tags captured regarding the current status and background
* After user's profile has been submitted and saved, the BOT determines the milestones/ steps/ interview processed and crossed and ask user to enter details of those experiences which are not tagged in current state

### Traditional form-based (on hold at this time as we want to implement the AI way and its implementation first)
In this method :
- the attributes will be shown in the form and user will be enter the values

## The data conflict scenarious
When we have captured the information here in user-profile which can capture some of information which we also capture when user submits a message, so basically we would have a overlap of sources of same information
Following are the scenarious:
- When same value of a json attribute (e.g. `current_visa_or_greencard_category`) is setup in user-profile and also provided in user's message then there is no conflict, so action needed. The information can be picked up from any of the sources
- when the value differ in two sources, then  user should be prompted to update user profile to keep it upto-date and BOT can also offer to update the information 
- User is not expected to provide any background of his information when his profile is already setup with background information. The app is expected to merge the information from a message and profile

## Architectural Decisions & Changes
- Backend systems will marry the two data provided in 2 sources: in user-profile as well as in message (if provided)
- In case of conflict user should be prompted to update usr-profile and/or offer to update yourself
- COnsider designing and implementing an Agent dedicated to reconcile/marry the data and perform updates, if required
- Where is the user profile data will be stored ? I believe it is firestore. Claude to provide details.