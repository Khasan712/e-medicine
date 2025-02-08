# Use official Python image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /bot

# Copy bot files
COPY . /bot

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Start the bot
CMD ["python", "bot.py"]
