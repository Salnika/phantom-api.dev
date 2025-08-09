import { tableManager } from '../src/database';

export const up = async () => {
  console.log('Seeding demo data...');

  // Create Users
  const user1 = await tableManager.create('User', {
    id: 'user_1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    age: 30,
    isActive: true,
    role: 'admin'
  });

  const user2 = await tableManager.create('User', {
    id: 'user_2',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    age: 24,
    isActive: true,
    role: 'user'
  });

  const user3 = await tableManager.create('User', {
    id: 'user_3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 35,
    isActive: false,
    role: 'user'
  });

  console.log('Users created:', user1.id, user2.id, user3.id);

  // Create Posts
  const post1 = await tableManager.create('Post', {
    id: 'post_1',
    title: 'My First Post',
    content: 'This is the content of my first post.',
    authorId: user1.id,
    published: true,
    views: 150
  });

  const post2 = await tableManager.create('Post', {
    id: 'post_2',
    title: 'Another Post by Alice',
    content: 'Alice writes again!',
    authorId: user1.id,
    published: true,
    views: 200
  });

  const post3 = await tableManager.create('Post', {
    id: 'post_3',
    title: "Bob's Great Article",
    content: 'A fascinating read by Bob.',
    authorId: user2.id,
    published: true,
    views: 100
  });

  const post4 = await tableManager.create('Post', {
    id: 'post_4',
    title: 'Draft Post',
    content: 'This post is not yet published.',
    authorId: user3.id,
    published: false,
    views: 50
  });

  console.log('Posts created:', post1.id, post2.id, post3.id, post4.id);

  console.log('Demo data seeded successfully.');
};

export const down = async () => {
  console.log('Reverting demo data...');
  // In a real scenario, you might want to delete records created by this seed.
  // For simplicity in a demo, we might just clear tables or rely on re-seeding.
  // await tableManager.delete('Post', 'post_1');
  // await tableManager.delete('Post', 'post_2');
  // await tableManager.delete('Post', 'post_3');
  // await tableManager.delete('Post', 'post_4');
  // await tableManager.delete('User', 'user_1');
  // await tableManager.delete('User', 'user_2');
  // await tableManager.delete('User', 'user_3');
  console.log('Demo data reversion complete (manual deletion might be needed for full cleanup).');
};
