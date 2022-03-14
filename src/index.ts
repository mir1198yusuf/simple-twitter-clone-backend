import 'dotenv/config'
import express, { Application, Request, Response, NextFunction } from 'express'
import { Model, Pojo, QueryContext } from 'objection'
import Knex, { Knex as KnexInterface } from 'knex'
import bcrypt from 'bcrypt'
import jwt from 'jwt-simple'
import cors from 'cors'

// init express
const app: Application = express()
const port = 8000
app.use(express.json())
app.use(cors())

// init knex
const knex: KnexInterface = Knex({
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE
  }
})

// connect knex to objection
Model.knex(knex)

/* Model classes */
class UserModel extends Model {
  name!: string
  email!: string
  password!: string
  id!: number
  handle!: string
  static tableName = 'yocket-prereqs-user'
  $formatJson(json: Pojo) {
    json = super.$formatJson(json)
    delete json.password // remove password from output
    return json
  }
}

class TweetModel extends Model {
  id!: number
  text!: string
  tweetedBy!: number
  tweetedAt!: number
  static tableName = 'yocket-prereqs-tweet'
  static relationMappings = {
    tweetedByUser: {
      relation: Model.BelongsToOneRelation,
      modelClass: UserModel,
      join: {
        from: 'yocket-prereqs-tweet.tweetedBy',
        to: 'yocket-prereqs-user.id'
      }
    }
  }
  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext)
    this.tweetedAt = Date.now()
    return
  }
}

class FollowerModel extends Model {
  id!: number
  followTo!: number
  followBy!: number
  followAt!: number
  static tableName = 'yocket-prereqs-follower'
  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext)
    this.followAt = Date.now()
    return
  }
}

// jwt verification middleware
const checkJwt = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.headers.authorization) {
      throw new Error()
    }
    const decoded = jwt.decode(
      req.headers.authorization.split(' ')[1],
      process.env.JWT_SECRET_KEY as string
    )
    if (decoded.iat + 86400000 < Date.now()) {
      // 1 day = 86400000 millisec
    }
    req.user = { id: decoded.userId }
    return next()
  } catch (error) {
    res.status(500).json({ error: 'Error 😒' })
    return
  }
}

app.post('/signup', async (req: Request, res: Response) => {
  const trx = await Model.startTransaction()
  try {
    const hash = await bcrypt.hash(req.body.password, 10)
    const user = await UserModel.query(trx).insert({
      handle: req.body.handle,
      name: req.body.name,
      email: req.body.email,
      password: hash
    })
    await trx.commit()
    res.status(200).json({ user })
    return
  } catch (error) {
    await trx.rollback()
    res.status(500).json({ error: 'Error 😒' })
    return
  }
})

app.post('/signin', async (req: Request, res: Response) => {
  const trx = await Model.startTransaction()
  try {
    const user = await UserModel.query(trx)
      .select('id', 'password')
      .where('email', req.body.email)
    const isCorrect = await bcrypt.compare(req.body.password, user[0].password)
    if (!isCorrect) {
      throw new Error()
    }
    await trx.commit()
    res.status(200).json({
      jwt: jwt.encode(
        {
          userId: user[0].id,
          iat: Date.now() // jwt issued at
        },
        process.env.JWT_SECRET_KEY as string
      ),
      userId: user[0].id
    })
    return
  } catch (error) {
    await trx.rollback()
    res.status(500).json({ error: 'Error 😒' })
    return
  }
})

app.get('/users/:userId', checkJwt, async (req: Request, res: Response) => {
  const trx = await Model.startTransaction()
  try {
    const user = await UserModel.query(trx).findById(req.params.userId)
    await trx.commit()
    res.status(200).json({
      user
    })
    return
  } catch (error) {
    await trx.rollback()
    res.status(500).json({ error: 'Error 😒' })
    return
  }
})

// get followed users by me
app.get(
  '/users/:userId/followers',
  checkJwt,
  async (req: Request, res: Response) => {
    const trx = await Model.startTransaction()
    try {
      const followers = await FollowerModel.query(trx)
        .select('*')
        .where('followBy', req.user.id)
      await trx.commit()
      res.status(200).json({ followers })
      return
    } catch (error) {
      await trx.rollback()
      res.status(500).json({ error: 'Error 😒' })
      return
    }
  }
)

app.post(
  '/users/:userId/followers',
  checkJwt,
  async (req: Request, res: Response) => {
    const trx = await Model.startTransaction()
    try {
      const follower = await FollowerModel.query(trx).insert({
        followTo: parseInt(req.params.userId),
        followBy: req.user.id
      })
      await trx.commit()
      res.status(200).json({ follower })
      return
    } catch (error) {
      await trx.rollback()
      res.status(500).json({ error: 'Error 😒' })
      return
    }
  }
)

app.get('/tweets', checkJwt, async (req: Request, res: Response) => {
  const trx = await Model.startTransaction()
  try {
    const tweets = await TweetModel.query().whereIn(
      'tweetedBy',
      FollowerModel.query(trx).select('followTo').where('followBy', req.user.id)
    )
    await trx.commit()
    res.status(200).json({ tweets })
    return
  } catch (error) {
    await trx.rollback()
    res.status(500).json({ error: 'Error 😒' })
    return
  }
})

app.post('/tweets', checkJwt, async (req: Request, res: Response) => {
  const trx = await Model.startTransaction()
  try {
    const tweet = await TweetModel.query(trx).insert({
      text: req.body.text,
      tweetedBy: req.user.id
    })
    await trx.commit()
    res.status(200).json({ tweet })
    return
  } catch (error) {
    await trx.rollback()
    res.status(500).json({ error: 'Error 😒' })
    return
  }
})

app.listen(process.env.PORT || port, () =>
  console.log(`Server running on ${port} 🚀`)
)
