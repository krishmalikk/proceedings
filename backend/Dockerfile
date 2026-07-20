FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py query.py search_client.py posting.py profile.py reconcile.py interactions.py matching.py group_messages.py moderation.py seed_users.json ./
COPY tags-cleaned/ ./tags-cleaned/

EXPOSE 8080

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
