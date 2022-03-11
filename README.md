# Simple Twitter Clone

This is a pre-requisite assignment (backend part) to be completed before starting actual development at [Yocket](https://yocket.com/).

### Technologies used

- Node Express for server
- PostgreSQL for database
- Objection.js for ORM
- TypeScript as programming language
- JWT for authentication
- VSCode for code editor
- Eslint Prettier for linting & formatting code

### Api endpoints list

- signup : post /signup
- signin : post /signin
- get user : get /users/:userId
- get tweets : get /tweets
- create tweet : post /tweets
- follow user : post /users/:userId/followers

### Database schema design

User

- id PK
- handle UK
- name
- email UK Index
- password

Tweet

- id PK
- text
- tweetedBy FK (user.id)
- tweetedAt

Follower

- id PK
- followTo FK (user.id)
- followBy FK (user.id) Index
- followAt
