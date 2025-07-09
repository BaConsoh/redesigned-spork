// Structure:
// /server -> backend (Node.js/Express)
// /client -> frontend (React)

// =======================
// BACKEND: server/index.js
// =======================
const express = require('express');
const fileUpload = require('express-fileupload');
const stripe = require('stripe')('your_stripe_secret_key');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const users = {}; // In-memory for demo. Use DB in production.

app.post('/create-checkout-session', async (req, res) => {
  const { email } = req.body;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: 'your_stripe_price_id', quantity: 1 }],
    customer_email: email,
    success_url: 'http://localhost:3000/dashboard?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://localhost:3000/',
  });
  res.json({ url: session.url });
});

app.post('/verify-subscription', async (req, res) => {
  const { session_id } = req.body;
  const session = await stripe.checkout.sessions.retrieve(session_id);
  const isActive = session.payment_status === 'paid';
  users[session.customer_email] = isActive;
  res.json({ active: isActive });
});

app.post('/transcribe', async (req, res) => {
  const { email } = req.body;
  if (!users[email]) return res.status(403).send('Subscription required');

  const audio = req.files.audio;
  const filePath = `./uploads/${audio.name}`;
  await audio.mv(filePath);

  // Transcription placeholder (simulate Whisper)
  res.json({ transcript: `Transcription for ${audio.name}` });
});

app.listen(4000, () => console.log('Server running on http://localhost:4000'));

// =======================
// FRONTEND: client/src/App.js
// =======================
import React, { useState } from 'react';

function App() {
  const [email, setEmail] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [active, setActive] = useState(false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');

  const subscribe = async () => {
    const res = await fetch('http://localhost:4000/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    window.location.href = data.url;
  };

  const verify = async () => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    setSessionId(sid);
    const res = await fetch('http://localhost:4000/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    const data = await res.json();
    setActive(data.active);
  };

  const uploadAndTranscribe = async () => {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('email', email);
    const res = await fetch('http://localhost:4000/transcribe', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setTranscript(data.transcript);
  };

  return (
    <div className="App">
      <h1>Transcription App</h1>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <button onClick={subscribe}>Subscribe</button>
      <button onClick={verify}>Verify Subscription</button>
      {active && (
        <div>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          <button onClick={uploadAndTranscribe}>Upload & Transcribe</button>
          <pre>{transcript}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
