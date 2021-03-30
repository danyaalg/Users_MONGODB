// imports
const express = require('express')
const bodyParser = require('body-parser')
const MongoClient = require('mongodb')
const jwt = require('jsonwebtoken')

// initialise the server
const app = express()
const port = 3000
const URI = 'mongodb+srv://<user>:<pw>@cluster0.lflnp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'

// configure body-parser middleware (helps to decode the body from a HTTP request)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

let collection // store the users

/*                                                    SETUP AUTHENICATION                                                    */
const JWT_SECRET = '1234oursecret'

// const authJWT = (req, res, next) => {
//   const auth = req.headers.authorization
//   if (auth) {
//     const token = auth.split(' ')[1]
//     jwt.verify(token, JWT_SECRET, (err, user) => {
//       if (err) res.sendStatus(403)
//       req.user = user
//       next()
//     })
//   } else {
//     res.sendStatus(401)
//   }
// }

// const requireAdmin = (req, res, next) => {
//   authJWT(req, res, next)
//   if (req.user.role !== 'admin') res.status(401).json('Admins only.')
// }

/*                                                    ROUTING                                                    */

app.get('/users', async (req, res) => {
  try {
    const users = await collection.find({}).toArray() // find the existing users from the users collection in mongo db
    res.status(200).json(users) // return result as json
  } catch (e) {
    res.status(500).send(e.message)
  }
})

app.get('/users/:id', async (req, res) => {
  const { id } = req.params // id given in the request params ({} is for destructoring object)
  try {
    const result = await collection.findOne({ _id: new MongoClient.ObjectID(id) }) // return object in collection that has a matching id with the one provided in request params
    res.status(200).json(result)
  } catch (e) {
    res.status(500).send(e.message)
  }
})

app.post('/users', async (req, res) => {
  const { username, password, role } = req.body
  try {
    if (['admin', 'member'].includes(role)) {
      const result = await collection.insertOne({ username, password, role }) // insert new object to collection
      const newUser = await collection.findOne({ _id: result.insertedId }) // return the object in collection with id of previously created entry
      res.status(201).json(newUser)
    } else {
      throw new Error('Role must be admin or member!')
    }
  } catch (e) {
    if (e.message === 'Role must be admin or member!') {
      res.status(406).send(e.message)
    } else {
      res.status(500).send(e.message)
    }
  }
})

app.put('/users/:id', async (req, res) => {
  const { id } = req.params
  const { username, password, role } = req.body
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new MongoClient.ObjectID(id) },
      { $set: { username, password, role } }, // $set replaces value of existing fields with specified value, if field doesnt exist new field will be added
      { upsert: true } // if no documents match filter -> create new document & return null OR updates single document that matches id filter
    )
    const updatedUser = await collection.findOne({
      _id: new MongoClient.ObjectID(id)
    })
    res.status(200).json(updatedUser)
  } catch (e) {
    res.status(500).send(e)
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

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params
  try {
    await collection.deleteOne({
      _id: new MongoClient.ObjectID(id)
    })
    res.status(204).json({})
  } catch (e) {
    res.status(500).send(e.message)
  }
})

// start the server
app.listen(port, async () => {
  const db = await MongoClient.connect(URI) // db is the initialised db object returned from connecting to the URI?
  const database = db.db('BNTA')
  collection = database.collection('users')
  const dbCollection = await collection.find({}).toArray()
  if (!dbCollection.length) {
    database.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['username', 'password'],
          additionalProperties: false,
          properties: {
            _id: {
              bsonType: 'objectId'
            },
            username: {
              bsonType: 'string',
              description: 'username'
            },
            password: {
              bsonType: 'string',
              description: 'password'
            }
          }
        }
      }
    })
  }
  console.log(`Server running on port ${port}`)
})
