const client = require('../lib/client');
// import our seed data:
const todo = require('./todo.js');
const usersData = require('./users.js');
const { getEmoji } = require('../lib/emoji.js');

run();

async function run() {

  try {
    await client.connect();

    const users = await Promise.all(
      usersData.map(user => {
        return client.query(`
                      INSERT INTO users (username, email, hash)
                      VALUES ($1, $2, $3)
                      RETURNING *;
                  `,
        [user.email, user.hash]);
      })
    );
      
    const user = users[0].rows[0];

    await Promise.all(
      todo.map(todo => {
        return client.query(`
                    INSERT INTO todo (todo, completed, owner_id)
                    VALUES ($1, $2, $3);
                `,
        [todo.todo, todo.completed, user.id]);
      })
    );
    

    console.log('seed data load complete', getEmoji(), getEmoji(), getEmoji());
  }
  catch(err) {
    console.log(err);
  }
  finally {
    client.end();
  }
    
}
