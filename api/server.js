// This minimal file satisfies the Docker build and startup requirements.

const express = require('express');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 8080;

// Basic route to confirm the API is running
app.get('/', (req, res) => {
  res.send('NFC API Backend is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}.`);
  console.log(`Database host: ${process.env.DB_HOST}`);
});

// We will add database connection and actual routes in the next step (Data Model)