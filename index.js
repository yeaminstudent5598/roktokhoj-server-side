const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB Configuration
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fw34o.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT Middleware


// Verify Admin Middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await client.db('roktoDB').collection('users').findOne({ email });
  if (!user || user.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};
const verifyVolunteer = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await client.db('roktoDB').collection('users').findOne({ email });
  if (!user || user.role !== 'volunteer') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

// API Routes
async function run() {
  try {
    // await client.connect();
    const userCollection = client.db('roktoDB').collection('users');
    const creatCollection = client.db('roktoDB').collection('create-donation-request')
 
    const blogsCollection = client.db('roktoDB').collection('blogs')
    const createPaymentCollection = client.db('roktoDB').collection('create-payment-intent')

    // JWT Route
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' });
      res.send({ token });
    });

   // Get All Users

    app.get('/users',verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;
        const query = {};
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        
        const users = await userCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get('/users/normal',verifyToken, async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;
        const query = {};
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        
        const users = await userCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get('/users/volunteer',verifyToken,verifyVolunteer, async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;
        const query = {};
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        
        const users = await userCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    
    // Check Admin Status
    app.get('/users/admin/:email',   async(req, res) =>{
      const email = req.params.email;
      
      const query = {email: email};
      const user = await userCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({admin});
    })
    // Check valunteer Status
    app.get('/users/valunteer/:email',   async(req, res) =>{
      const email = req.params.email;
     
      const query = {email: email};
      const user = await userCollection.findOne(query)
   
      let valunteer = false;
      if (user) {
        valunteer = user?.role === 'volunteer'
      }
 
      res.send({valunteer});
    })

    app.get('/create-donation-request',  async (req, res) => {
      const users = await creatCollection.find().toArray();
      res.send(users);
    });
    app.get('/create-donation-request', verifyToken, verifyVolunteer, async (req, res) => {
      const users = await creatCollection.find().toArray();
      res.send(users);
    });
    
    app.get('/donation-request/:email', async (req, res) => {
      const { email } = req.params;
      
      try {
        
        // if (req.user.email !== email) {
        //   return res.status(403).send({ message: 'Forbidden access' });
        // }
    
        // Query the database to find the user by email
        const user = await creatCollection.find({ requesterEmail: email }).toArray();
    
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    });

    //delete api create request 
    app.delete('/create-donation-request/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await creatCollection.deleteOne(query);
      res.send(result);
    });

    // PATCH API for updating donation request by ID
    app.patch('/create-donation-request/:id',verifyToken, async (req, res) => {
      const id = req.params.id; // Extract ID from URL parameters
      const updateData = req.body; // Get the fields to update from request body
    
      try {
        // Remove the _id field if it exists in the request body
        if (updateData._id) {
          delete updateData._id;
        }
    
        // Update the document with the specified ID
        const result = await creatCollection.updateOne(
          { _id: new ObjectId(id) }, // Filter by ID
          { $set: updateData } // Use $set to apply only the updated fields
        );
    
        if (result.matchedCount === 0) {
          // If no document matches the given ID
          return res.status(404).send({ message: 'Donation request not found' });
        }
    
        res.status(200).send({
          success: true,
          message: 'Donation request updated successfully',
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: 'Internal Server Error',
          error,
        });
      }
    });







    // PATCH API to update blood donation request status by ID
app.patch('/blood-donation-requests/status/:id',verifyToken, async (req, res) => {
  const id = req.params.id; // Extract ID from the request URL
  const { status, donorName, donorEmail } = req.body; // Extract fields from request body

  try {
    // Update the donation request status in the database
    const result = await creatCollection.updateOne(
      { _id: new ObjectId(id) }, // Filter the document by ID
      {
        $set: {
          status: status, // Update the status field
          donorName: donorName, // Optionally update donor name
          donorEmail: donorEmail, // Optionally update donor email
        },
      }
    );

    if (result.matchedCount === 0) {
      // No document found with the specified ID
      return res.status(404).json({
        success: false,
        message: 'Donation request not found',
      });
    }

    // If the update is successful
    res.status(200).json({
      success: true,
      message: 'Donation request updated successfully',
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error,
    });
  }
});

    

    
    
    
    
    // Promote User to Admin
    app.patch('/users/admin/:id',verifyToken, verifyAdmin,  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: 'admin' } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // Promote User to volunteer
    app.patch('/users/volunteer/:id',verifyToken, verifyVolunteer,  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc =  { $set: { role: 'volunteer' } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    

    // Add New User
    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //donation api

    // Get a specific donation request by ID
app.get('/create-donation-request/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const donationRequest = await creatCollection.findOne(query);

    if (!donationRequest) {
      return res.status(404).send({ message: 'Donation request not found' });
    }

    res.send(donationRequest);
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});




    //create blood donation


    app.post('/create-donation-request',  async(req, res) =>{
      const donationRequest = req.body;
      const result = await creatCollection.insertOne(donationRequest)
      res.send(result);
    });

    //blog api
    app.get('/blogs',  async (req, res) => {
      const blogs = await blogsCollection.find().toArray();
      res.send(blogs);
    });

    app.get('/blogs/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const blogDetails = await blogsCollection.findOne(query);
    
        if (!blogDetails) {
          return res.status(404).send({ message: 'Blog not found' });
        }
    
        res.send(blogDetails);
      } catch (error) {
        res.status(500).send({ message: 'Internal server error' });
      }
    });
    

    app.post('/blogs',  async(req, res) =>{
      const newBlogs = req.body;
      const result = await blogsCollection.insertOne(newBlogs)
      res.send(result);
    });

    // PATCH API to update blog status by ID
app.patch('/blogs/status/:id',verifyToken, verifyAdmin, async (req, res) => {
  const blogId = req.params.id; // Get the blog ID from the URL parameters
  const { status } = req.body; // Get the status value from the request body

  try {
    // Update the status of the specific blog
    const result = await blogsCollection.updateOne(
      { _id: new ObjectId(blogId) }, // Find the blog by its ID
      { $set: { status: status } }    // Set the new status value
    );

    if (result.modifiedCount === 0) {
      // If no document was updated (either the blog was not found or status was the same)
      return res.status(404).send({ message: 'Blog not found or status not changed' });
    }

    // Respond with success
    res.status(200).send({
      success: true,
      message: `Blog status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: 'Internal server error',
      error,
    });
  }
});


app.delete('/blogs/:id',verifyToken,verifyAdmin, async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await blogsCollection.deleteOne(query);
  res.send(result)
})


const stripe = require('stripe')(process.env.PAYMENT_METHON_SECRET_KEY);

app.post("/create-payment-intent", async (req, res) => {
  const { amount, user } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, 
      currency: "usd", 
      metadata: { user }, 
      
    });
    
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
  
    res.status(500).send("Failed to create payment intent");
  }
});



// Save Payment Intent Endpoint
app.post("/save-payment-intent", async (req, res) => {
  const { amount, customer, avatar, date } = req.body;

  
    // Insert the record into the database
    const result = await createPaymentCollection.insertOne({
      amount,
      customer,
      avatar,
      date: new Date().toISOString(),
    });

    return res.status(200).send(result);
  })

  app.get('/create-payment-intent',  async (req, res) => {
    const payments = await createPaymentCollection.find().toArray();
    res.send(payments);
  });


    
    app.patch('/donation-details/:id',verifyToken, async(req, res) =>{
      const userId = req.params.id;
  const { status, donorName, donorEmail } = req.body; // Get status from request body
  
  try {
    const result = await creatCollection.updateOne(
      { _id: new ObjectId(userId) }, // Find user by ID
      { $set: { status: status, donorEmail: donorEmail, donorName: donorName } }   
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: `User status updated to ${status}` });
    } else {
      res.status(404).json({ error: 'User not found or status not changed' });
    }
  } catch (error) {
    
    res.status(500).json({ error: 'Internal server error' });
  }
});



    
// Block or Unblock User
app.patch('/users/status/:id',verifyToken, verifyAdmin, async (req, res) => {
  const userId = req.params.id;
  const { status } = req.body; // Get status from request body
  
  try {
    const result = await userCollection.updateOne(
      { _id: new ObjectId(userId) }, // Find user by ID
      { $set: { status: status } }   // Update the status
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: `User status updated to ${status}` });
    } else {
      res.status(404).json({ error: 'User not found or status not changed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch("/users/:email",verifyToken, async (req, res) => {
  const { email } = req.params;
  let updatedProfile = req.body;
  
  // Remove the '_id' field if it exists
  const { _id, ...profileData } = updatedProfile;  // This excludes _id

  const result = await userCollection.updateOne(
    { email },
    { $set: profileData }
  );

  res.send(result);
});


app.get('/users/:email', async (req, res) => {
  const { email } = req.params;  // Get the email from the URL parameter
  const user = await userCollection.findOne({ email });  // Find the user by email
  if (user) {
    res.send(user);  // If user found, send the user data
  } else {
    res.status(404).send({ message: 'User not found' });  // If user not found, send 404 error
  }
});



    app.delete('/users/:id',verifyToken, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    console.log('Connected to MongoDB!');
  } finally {
    // Do not close the client connection for continuous operation
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Roktokhoj server is running!');
}); 

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
