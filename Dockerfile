FROM python:3.11-slim
WORKDIR /app
COPY ml/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ml/ .
# Supply a trained checkpoint at runtime: -v "$PWD/artifacts:/app/artifacts:ro"
EXPOSE 8000
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8000"]
