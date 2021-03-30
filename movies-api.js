const express = require('express')
const bodyParser = require('body-parser')
const MongoClient = require('mongodb')
const jwt = require('jsonwebtoken')

const app = express()
const port = 3001
const URI =
  'mongodb+srv://<user>:<pw>@cluster0.lflnp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

let collection

// const employees = [
//   {
//     username: 'kim',
//     password: '1234kim',
//     role: 'admin'
//   },
//   {
//     username: 'joe',
//     password: '1234joe',
//     role: 'contractor'
//   }
// ]

const JWT_SECRET = '1234oursecret'

const authJWT = (req, res, next) => {
  const auth = req.headers.authorization
  if (auth) {
    const token = auth.split(' ')[1]
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) res.sendStatus(403)
      req.user = user
      next()
    })
  } else {
    res.sendStatus(401)
  }
}

const requireAdmin = (req, res, next) => {
  authJWT(req, res, next)
  if (req.user.role !== 'admin') res.status(401).json('Admins only.')
}

// route definition
app.get('/movies', authJWT, async (req, res) => {
  try {
    const movies = await collection.find({}).toArray()
    res.status(200).json(movies)
  } catch (e) {
    res.status(500).send(e.message)
  }
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await collection.findOne({ username: username, password: password })
  if (user) {
    const accessToken = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET
    )
    res.send({ accessToken })
  } else {
    res.send('Username or password incorrect')
  }
})

// app.post('/login', (req, res) => {
//   const { username, password } = req.body
//   const user = employees.find(
//     (employee) =>
//       employee.username === username && employee.password === password
//   )
//   if (user) {
//     const accessToken = jwt.sign(
//       { username: user.username, role: user.role },
//       JWT_SECRET
//     )
//     res.send({ accessToken })
//   } else {
//     res.send('Username or password incorrect')
//   }
// })

app.post('/movies', requireAdmin, async (req, res) => {
  const { title, director } = req.body
  try {
    const result = await collection.insertOne({ title, director })
    const newMovie = await collection.findOne({ _id: result.insertedId })
    res.status(201).json(newMovie)
  } catch (e) {
    res.status(500).send(e)
  }
})

app.put('/movies/:id', async (req, res) => {
  const { id } = req.params
  const { title, director } = req.body
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new MongoClient.ObjectID(id) },
      { $set: { title, director } },
      { upsert: true }
    )
    const updatedMovie = await collection.findOne({
      _id: new MongoClient.ObjectID(id)
    })
    res.status(200).json(updatedMovie)
  } catch (e) {
    res.status(500).send(e)
  }
})

app.delete('/movies/:id', async (req, res) => {
  const { id } = req.params
  try {
    await collection.deleteOne({
      _id: new MongoClient.ObjectID(id)
    })
    res.status(204).json({})
  } catch (e) {
    res.status(500).send(e)
  }
})

// start the server
app.listen(port, async () => {
  const db = await MongoClient.connect(URI)
  const database = db.db('BNTA')
  collection = database.collection('movies')
  const dbCollection = await collection.find({}).toArray()
  if (!dbCollection.length) {
    database.createCollection('movies', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['title', 'director'],
          additionalProperties: false,
          properties: {
            _id: {
              bsonType: 'objectId'
            },
            title: {
              bsonType: 'string',
              description: 'the title of a movie'
            },
            director: {
              bsonType: 'string',
              description: 'the director of the movie'
            }
          }
        }
      }
    })
  }
  console.log(`Server running on port ${port}`)
})
