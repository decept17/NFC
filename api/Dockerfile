# Use a slim, secure base image for Node.js
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to cache dependencies efficiently
COPY package*.json ./

# Install application dependencies (including production dependencies)
RUN npm install --omit=dev

# Copy the rest of the application source code (routes, services, etc.)
COPY . .

# Expose the port the Node.js application will run on (e.g., 8080)
EXPOSE 8080

# Command to run the application when the container starts
CMD [ "node", "server.js" ]

# Note: server.js is the assumed entry point for your Node.js API
