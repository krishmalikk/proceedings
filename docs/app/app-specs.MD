
# Product Requirements Document: AI-Powered Listing Platform (Web App)

## 1. Executive Summary

This document outlines the specifications for a web-based and mobile based platform that uses an AI chatbot interface as the primary method for users to search for, interact with and create postings . 
The goal is to replace traditional form-based search and submission with a conversational, intuitive experience.

## 2. Product Vision & Goals

The app referred in this document refers to both mobile and web version of same functionality.

### Vision: 
- To create the most frictionless and intuitive us-immigration vertical platform by leveraging natural language processing for both discovery and creation. 
- Use labelling/tagging tools and advanced Vertex AI features in backend
- Acts as an expert on US Immigration with generic knowledge base along with postings ingested by this website as well other websites like reddit.com


### Goals:
- Use symmantic search to find similar postings based upon labelling created in backend and stored with the content as sidecar pattern
- Use Machine Leaning / advanced Gemini / LLM features to connect people who are in same boat of US Immigration journey
- Increase search relevance by understanding user intent rather than just keywords. 
- Provide a mobile-first, highly responsive user experience.
- have abilility to setup a profile to capture basic details of user's journey into US immigration
- Store metadata of each posting in same json format in same sidecar pattern with content in Vertex AI search as ingested from reddit.com
- Chatbot captures basic information (if not already setup) which can be represented as tags as specified in various CSV files located in [tags](../../backend/tags-cleaned) in a JSON format specified in [content-ingestion=specifications](../ingestion)
- The information captured for the user is stored in GCP backend against the generated userid and will be provided as context to Gemini, as needed

## 3. Target Audience
Seekers: Users looking for advise on any US immigration topic, connect with people in similar journey

Posters: Users wanting to post their experience and their journey which can help other applicants in their journey

## 4. Context Reference Documents**

Below documents refer to the backend processes of content ingestion from other websites (like reddit.com), data labelling and store ito Vertex AI Search.
1. Folder containing various context documents [content-ingestion-specification](../ingestion)
3. Folder containing tagging specifications [tagging-pecifications](../tagging)
4. Folder containing master list of tags which will be used for tagging [tags-cleaned](../../backend/tags-cleaned)


## 5. Key Features & Functionality

- This app acts as  additional channel of contents/ postings ingestion related to US Immigration similar to reddit API ingestion where user can directly post or ask question. 
- Ability to detect if this app is being accessed from within the USA or outside and this will determine the behaviour of the user's experience
- This app is an interface to symmetric search from Vertex AI Search backend on the content ingested from this app as well as from other pipelines like reddit.com


### 5.1. The AI Chatbot Interface (Core Interaction)

**Conversational UI**: A central, prominent chat interface that serves as the main entry point for all actions.

**Natural Language Understanding (NLU)**: The ability to parse complex queries.

**Example Search**: "I'm looking for experiences from applicatts with recent B-1/B-2 visa interview experiance in Mumbai consulate"

**Example Post**: `I want to post my timelines for a recent h1b-extention experience.
H1B premium processing timeline - Texas center.
April 27 - applied
April 29 - received notice
May 4 - Case is Still Being Processed`

**Intent Recognition**: The system must accurately determine if the user intends to search, post, manage an account, or ask a general question.

**Context Management**: The chatbot must remember the current conversation state.

**Proactive Prompting**: If a user misses required information while posting, the chatbot asks specific questions to fill the gaps. 
For example:

***When a user is using app from outside USA***
- Are you currently holding any USA Visa ?
- Are you looking to apply for USA visa ?
- Is this the first time applying for a USA visa ?
- What visa category you want to apply for ?
- Do you need help to check which visa category you can qualify for ?
- Have you ever applied for a USA visa before ?

***When a user already knows which visa category to apply and is outside USA***
- Do you know what you need to apply for this visa ?
- Can I help you get an appointment for this visa ?
- DO you know which consulate do you want to go to ?
- Can I help you determine which consulate you are eligible to go for visa-interview ?

***When a user already has interview scheduled***
- Do you need help to prepare for interview ?
- Do you want to see other applicants' experience who appeared for this interview recently ?

***When a user is using app from within USA***
- What visa do you currently hold ?
- Is your visa/status expiring ?
- Are you running into any potential issue with your visa/status in USA ?
- Are you exploring other options ?
- Have you applied for immigration or green-card ?

***When a user wants to apply for immigration/green-card***
- Are you already in USA or outside USA ?
- who can sponsor you for green-card ?

***When a user has already applied for immigration/green-card***
- What stage are you in your green-card processing ?
- What immigration category have you applied ? EB-2/3 / family etc. ?
- Are you going for consular-processing (outside USA) or adjustment-of-status(AOS) from within USA ?
- Do you want to see other folks experience like yours ?
- Do you want to share your journey so far for other applicantss benefit ?

**Key acitivity background**:
1. Any information which helps in capturing attributes for tagging/metadata, on the background  / context / intent for USA immigration should be asked in the conversation
2. The components of information entered by user is captured are corresponding metadata stored in json for each session.
4. A middle-tier LLM layer should be able to decipher this conversation into artiafcts ingested into Vertex AI Search in backend as specified in architecture folder [Architecture](../ingestion) 


### 5.2. Searching via Chat

#### Knowledge base 
There are two kinds of results returned when users seeks to search:
1) Search within the content postings grounded in Vertex AI datastore
2) When asked for advise, the conversational chatbot can act as an expert of US Immigration system, although a disclaimer should be provided as this advise provided is not a legal advice.

#### Presentation
Dynamic Results Display: Search results are presented within or alongside the chat interface in a rich card format (title, key details).

Conversational Filtering: Users can refine results using natural language (e.g., "Show me recent experiences only," "Only show ones posted today").

Saved Searches & Alerts: Users can tell the bot to "notify me when a posting like this is posted."

### 5.3. Posting via Chat

Step-by-Step Extraction: The AI extracts entities from the user's initial prompt.

Draft & Review: Before publishing, the bot presents a summary card of the parsed mesage with key attributes as in metadata json extracted and shown to users.

Categorization: Automatic via and tag categorization based on the description, with a fallback option for the user to correct it.

### 5.4. User Accounts & Management

Authentication: Sign up/Login via email, Google, or Apple. with a synthetic made up username similar to reddit.com

Dashboard: A separate view (or bot command) to view similar postings, or view saved searches.

Messaging: (Optional/V2) In-app messaging between Seekers and Posters, potentially facilitated or moderated by the AI.

### 5.5 User Profile

#### Setup: User enters basic information specifically relevant about their journey in US Immigration system
#### Basic Information: At the time of onboarding a user or when user is seeking / posting information, a basic information of the user (applicant) should be gathered. 
For example:
- If a person already is USA on `F-1`, `H-1` etc, then using the flow in diagram [f1-to-h1-gc](./imm-flows-example/f1-to-h1-gc.png) determine through the Conversational AI chatbot what stage is the applicant is in and what stage he planning to go next
- If a person does not live in USA and applying from a consulate abroad then determine the basic information on visa category, first-time, any prior visas etc.
- If a person already applied for a visa abroad then determine user's experience of interview/process along with outcome and any tips the user can provide to future applicants
- Acting as an expert of US Immigration sustem, if any of above flows does not apply to applicant then determine what non-immigrant or immigrant flow applies to the applicant and follow that flow to determine applicant's stage
#### Capture thie one-time basic information of the user and allow user to keep providing updates to the status of his/her US immigration journey, along with dates, as and when it happens
#### This basic information should be stored in backend in GCP and should be accessed by Vertex AI Conversational system as context
#### No personal information PII or PII should be gathered in setting up user profile


## 6 Technical Specifications

### 6.1. Front-End (Web)

Framework: A modern web framework for a responsive single-page application (SPA).

Styling: Tailwind CSS or similar utility-first framework for rapid UI development.

Chat UI Component: A robust chat interface supporting rich media (cards, buttons, image uploads) within the chat stream.

### 6.2. Back-End & API

**Framework**: Python (Django/FastAPI).

**Database** Vertex AI Search

**AI/LLM Integration**

Integration with an LLM API (e.g. Google Gemini) for intent recognition, entity extraction, and conversational responses.

Prompt Engineering: Carefully crafted system prompts to restrict the bot's behavior to the platform's domain (preventing off-topic conversations).

### 6.3. Infrastructure & Hosting

Cloud Provider: Google Cloud component (for front-end). Help me decide.

File Storage: Google Cloud Storage, Vertex AI Search

CDN: Google CLoud provider for fast asset delivery.


## 7. User Flows

### 7.1 Flow 1: Onboarding / User profile
See section 5.5 above on User Profile
#### Case1: App detects User is outside USA and his/her profile not setup

Bot greets: "Hi! Are you looking to apply for a US visa or general information regarding US visas ?"

User: "yes, I need to apply for a B-1 visa"

Bot responds: "I can help you with that. Do you already have a visa interview scheduled or need help in scheduling ?"

User: " I already have it scheduled"

Bot Responds: "When is it scheduled ?"

User: "06/10/2026"

Bot Responds: "Great. I have other users who are scheduled before you for same visa. Would you like to know their experiences ?"

User: "Yes, please"

Bot Responds: "Great, while I search for other user's experiences, please provide your basic information so that I provide precise information to you"

System then ask for basic information which can be represented as tags as specified in various CSV files located in [tags](../../backend/tags-cleaned) in a JSON format specified in [content-ingestion=specifications](../ingestion)

System queries from Verttex AI backend.

### 7.2 Flow 1: Searching

User lands on homepage.

Bot greets: "Hi! Are you looking to search or post something?"

User: "I need to see recent experieance from applicants appeared in Mumbai consulate for B-1/B-2 visa"

System queries from Verttex AI backend.

Bot responds: "Here are some recent experiences from applicants appeared in Mumbai consulate for B-1/B-2 visa" and displays a carousel of listing cards.

### Flow 3: Posting

User lands on homepage.

User: "I want to post my experience for H-1 visa"

Bot: "Great. Is it first time H-1 visa or an extension ?"

User: "first-time"

Bot: "Are you currently in USA on different visa ot applying from outside USA ?"

The intent of the bot is to capture ball asic information about applicant's background, situation, intent, concerns/questions related to USA immigration.
All the basic information attributes that should be captured as much as possible is in [JSON-SCHEMA-FIELD-DICTIONARY](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md)

## 8. Stitch Implementation Strategy

To build this in the Stitch canvas, use the following prompt sequence:

### Step 1: Layout Generation
Prompt: "Generate a high-fidelity mobile UI for a social app called 'The Hive.' 
Use a 'Neural Expressive' design language with glassmorphism. 
The home feed should look like Gemini but with a persistent floating AI chat bubble at the bottom right. Use deep purples and neon teal accents."

### Step 2: Prototyping the "Post" Flow
Prompt: "Create a secondary screen for a conversational posting flow. 
It should look like a messaging app where the AI asks questions, and as the user answers, a 'Post Preview' card grows at the top of the screen."

### Step 3: Exporting for Development
Once the "Vibe" is set:
1. Stitch Preview: Use the "Play" button in Stitch to test the transition from chat to post.
2. Export: Use the "Export to Developer Tools" feature to get the React/Tailwind code for the frontend.  
3. Backend Integration: Connect the generated frontend to Vertex AI Agent Builder to handle the actual conversational logic.

## 9. Analytics & Tracking

Track user intents (Search vs. Post vs Browse).

Track drop-off points during the conversational posting flow.

Analyze common search queries that return zero results to identify content gaps.

## 10. Your role

You are an Architect and a website designer for this flow of inegestion from website into GCP Vertex AI Search


## 11. Operational notes

- **Model**: Gemini Flash for bulk re-tagging, Gemini Pro for ambiguous cases.
- **Prompt caching**: Cache the master tag CSVs in the prompt (~30k tokens); refresh on tag-list edit.
- **Validation gate**: Block ingestion on validator failure; quarantine until manually resolved.
- **Telemetry**: Track `tagging_confidence` distribution and `severity` mix to detect drift.
