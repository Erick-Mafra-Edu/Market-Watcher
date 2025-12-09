FROM python:3.11-slim

WORKDIR /app

# Install chromium and dependencies for web scraping
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Run the service
CMD ["python", "-u", "src/main.py"]
