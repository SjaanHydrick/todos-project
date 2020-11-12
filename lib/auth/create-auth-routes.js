const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('./jwt');
const client = require('../client');
const ensureAuth = require('./ensure-auth');

function getProfileWithToken(user) {
  // eslint-disable-next-line no-unused-vars
  const { hash, ...rest } = user;
  return {
    ...rest,
    token: jwt.sign({ id: user.id })
  };
}

const defaultQueries = {
  selectUser(email) {
    return client.query(`
      SELECT id, username, email, hash
      FROM users
      WHERE email = $1;
  `,
    [email]
    ).then(result => result.rows[0]);
  },
  insertUser(user, hash) {
    return client.query(`
      INSERT into users (username, email, hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email;
  `,
    [user.username, user.email, hash]
    ).then(result => result.rows[0]);
  }
};

module.exports = function createAuthRoutes(queries = defaultQueries) {
  // eslint-disable-next-line new-cap
  const router = express.Router();

  router.get('/verify', ensureAuth, (req, res) => {
    res.json({ verified: true });
  });

  router.post('/signup', (req, res) => {
    const { password, ...user } = req.body;
    const username = user.username;
    const email = user.email;

    // username email and password needs to exist
    if(!username || !email || !password) {
      res.status(400).json({ error: 'Username, E-Mail, and Password Required' });
      return;
    }

    // email needs to not exist already
    queries.selectUser(email)
      .then(foundUser => {
        if(foundUser) {
          res.status(400).json({ error: 'E-Mail Already Exists' });
          return;
        }
    
        //username needs to not exist already
        queries.selectUser(username)
          .then(foundUser => {
            if(foundUser) {
              res.status(400).json({ error: 'Username Already Exists' });
              return;
            }
          });

        // insert into profile the new user
        queries.insertUser(user, bcrypt.hashSync(password, 8))
          .then(user => {
            res.json(getProfileWithToken(user));
          });
      });
  });

  router.post('/signin', (req, res) => {
    const body = req.body;
    const username = body.username;
    const email = body.email;
    const password = body.password;

    // email and password needs to exist
    if(!username || !email || !password) {
      res.status(400).json({ error: 'Username, E-Mail and Password Required' });
      return;
    }

    // username does not exist
    queries.selectUser(username)
      .then(foundUser => {
        if(!foundUser) {
          res.status(400).json({ error: 'Username Does Not Exist' });
          return;
        }
      });

    queries.selectUser(email)
      .then(foundUser => {
        if(!foundUser) {
          res.status(400).json({ error: 'E-Mail Does Not Exist' });
          return;
        }
      });

    queries.selectUser(email)
      .then(user => {
        // does email match one in db?
        // #1 !user - if no user, then no match on a row for email
        // #2 !compareSync - provided password did not match hash from db
        if(!user || !bcrypt.compareSync(password, user.hash)) {
          res.status(400).json({ error: 'E-Mail or Password Incorrect' });
          return;
        }

        res.json(getProfileWithToken(user));
      });
  });

  return router;
};
