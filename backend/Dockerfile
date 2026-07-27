FROM python:3.13-slim

# Unbuffered stdout/stderr — without this, print() output is block-buffered
# (not a TTY) and never flushes before a killed/timed-out request, which is
# exactly what made a real production hang in /internal/gov-news/poll
# undiagnosable from Cloud Run logs alone (2026-07-27).
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py query.py search_client.py posting.py profile.py reconcile.py interactions.py matching.py group_messages.py moderation.py news_sources.py gov_news_poll.py seed_users.json ./
COPY tags-cleaned/ ./tags-cleaned/

EXPOSE 8080

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
