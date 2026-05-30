
# Product Requirements Document: AI-Powered Listing Platform (Web App)

## 1. Executive Summary

This document outlines the specifications for a web-based platform that uses an AI chatbot interface as the primary method for users to search for, interact with and create postings . The goal is to replace traditional form-based search and submission with a conversational, intuitive experience.

## 2. Product Vision & Goals

### Vision: 
- To create the most frictionless and intuitive listing platform by leveraging natural language processing for both discovery and creation. using labelling tools and advanced Vertex AI featured
- Acts as an expert on US Immigration on generic informat

### Goals:
- Use symmantic search to find similar postings based upon labelling created in backend and stored with the content
- Use Machine Leaning / advanced Gemini / LLM featured to connect people who are in same boat of US Immigration journey
- Increase search relevance by understanding user intent rather than just keywords. 
- Provide a mobile-first, highly responsive user experience.
- have abilility to setup a profile to capture basic details of user's journey into US immigration

## 3. Target Audience
Seekers: Users looking for advise on any US immigration topic, connect with people in similar journey

Posters: Users wanting to post their experience and their journey which can help other applicants in their journey

## 4. Context Reference Documents**

Below documents refer to the backend processes of content ingestion from other websites (like reddit.com), data labelling and store ito Vertex AI Search.
1. Folder containing various context documents [content-ingestion-specification](../content-ingestion-specifications)
2. Pipeline to ingest from reddit.com  [reddit-ingestion-pipelines](../content-ingestion-specifications/REDDIT-INGESTION-PIPELINE.md) 
3. Folder containing tagging specifications [tagging-pecifications](../tagging-specifications)
4. Folder containing master list of tags which will be used for tagging [tags-cleaned](../tags-cleaned)
5. Folder containing examples of postings and corresponding metadata / labels/ tags created for that posting [posting-examples](../postings-examples)

This app is another channel of ingestion and also an interface to symmetric search from this content.

## 5. Key Features & Functionality

- This app acts as  additional channel of contents/ postings related to US Immigration similar to reddit API ingestion where user can directly post or ask question. 
- Ability to detect if this app is being accessed from within the USA or outside and this will determine the behaviour of the user's experience

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
4. A middle-tier LLM layer should be able to decipher this conversation into artiafcts ingested into Vertex AI Search in backend as specified in architecture folder [Architecture](../content-ingestion-specifications) 


### 5.2. Searching via Chat

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

Setup: User enters basic information specifically relevant about their journey in US Immigration system


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

### 7.1 Flow 1: Searching

User lands on homepage.

Bot greets: "Hi! Are you looking to search or post something?"

User: "I need to see recent experieance from applicants appeared in Mumbai consulate for B-1/B-2 visa"

System queries from Verttex AI backend.

Bot responds: "Here are some recent experiences from applicants appeared in Mumbai consulate for B-1/B-2 visa" and displays a carousel of listing cards.

### Flow 2: Posting

User lands on homepage.

User: "I want to post my experience for H-1 visa"

Bot: "Great. Is it first time H-1 visa or an extension ?"

User: "first-time"

Bot: "Are you currently in USA on different visa ot applying from outside USA ?"

The intent of the bot is to capture ball asic information about applicant's background, situation, intent, concerns/questions related to USA immigration.
All the basic information attributes that should be captured as much as possible is in [JSON-SCHEMA-FIELD-DICTIONARY](../tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md)

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
