require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
const cors = require('cors');
const port = process.env.PORT || 3000;

const app = express();

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// Schemas e Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const messageSchema = new mongoose.Schema({
  text: String,
  audio: String,
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  reply: { text: String, sender: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Middlewares
app.use(express.json());
app.use(cors({
  origin: 'https://cnappp.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Gerar JWT
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1h' });
}

app.get('/', (req, res) => {
  res.send('✅ API está online!');
});

// Registro
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).send('Usuário já existe');

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    const token = generateToken(newUser._id);
    res.status(201).send({ token });
  } catch (err) {
    res.status(500).send('Erro no servidor ao registrar');
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).send('Usuário ou senha inválidos');

    const token = generateToken(user._id);
    res.status(200).send({ token });
  } catch (err) {
    res.status(500).send('Erro no servidor ao fazer login');
  }
});

// Enviar mensagem
app.post('/messages', async (req, res) => {
  try {
    const { text, audio, sender, receiver, reply } = req.body;

    if (!sender || !receiver)
      return res.status(400).send('Sender e Receiver são obrigatórios');

    const message = new Message({ text, audio, sender, receiver, reply });
    await message.save();
    res.status(201).send(message);
  } catch (err) {
    res.status(400).send(err);
  }
});

// Recuperar mensagens
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 });
    res.send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Recuperar usuários
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('username');
    res.send(users);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Exportação serverless (Vercel)
module.exports = app;
module.exports.handler = serverless(app);