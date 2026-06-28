// Run this once with: node seed.js
// Populates sample shops and products with real photos and real coordinates for the map.
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const Shop = require("./models/Shop");
const Product = require("./models/Product");
const User = require("./models/user");
const bcrypt = require("bcryptjs");

dotenv.config();

// Real photo URLs from LoremFlickr (free, no API key, actual photos tagged by keyword)
const photo = (keyword) => `https://loremflickr.com/400/300/${keyword}`;

const run = async () => {
  await connectDB();

  await Shop.deleteMany({});
  await Product.deleteMany({});

  // Create a demo vendor account to own the seeded shops (or reuse if it already exists)
  let vendor = await User.findOne({ email: "vendor@localkart.com" });
  if (!vendor) {
    const hashedPassword = await bcrypt.hash("vendor123", 10);
    vendor = await User.create({
      name: "Demo Vendor",
      email: "vendor@localkart.com",
      password: hashedPassword,
      role: "vendor"
    });
    console.log("Demo vendor created -> email: vendor@localkart.com / password: vendor123");
  }

  // Create a demo admin account too - admins are never created via the public register form for security
  let admin = await User.findOne({ email: "admin@localkart.com" });
  if (!admin) {
    const hashedAdminPassword = await bcrypt.hash("admin123", 10);
    admin = await User.create({
      name: "Demo Admin",
      email: "admin@localkart.com",
      password: hashedAdminPassword,
      role: "admin"
    });
    console.log("Demo admin created -> email: admin@localkart.com / password: admin123");
  }

  // Real-world coordinates around MG Road, Bengaluru so the map shows real nearby distances
  const shops = await Shop.insertMany([
    {
      name: "Green Basket",
      category: "Fresh",
      address: "MG Road, Bengaluru",
      owner: vendor._id,
      image: photo("grocery,vegetables"),
      letter: "G",
      rating: 4.6,
      location: { type: "Point", coordinates: [77.6094, 12.9756] }
    },
    {
      name: "Apollo Pharmacy",
      category: "Medicine",
      address: "Indiranagar, Bengaluru",
      owner: vendor._id,
      image: photo("pharmacy,medicine"),
      letter: "P",
      rating: 4.8,
      location: { type: "Point", coordinates: [77.6412, 12.9784] }
    },
    {
      name: "Bake House",
      category: "Bakery",
      address: "Koramangala, Bengaluru",
      owner: vendor._id,
      image: photo("bakery,bread"),
      letter: "B",
      rating: 4.4,
      location: { type: "Point", coordinates: [77.6271, 12.9352] }
    }
  ]);

  await Product.insertMany([
    { name: "Fresh Milk 1L", shop: shops[0]._id, category: "Dairy", price: 60, stock: 50, image: photo("milk"), letter: "M" },
    { name: "Brown Bread", shop: shops[2]._id, category: "Bakery", price: 45, stock: 30, image: photo("bread"), letter: "B" },
    { name: "Paracetamol Strip", shop: shops[1]._id, category: "Medicine", price: 25, stock: 100, image: photo("medicine,tablets"), letter: "M" },
    { name: "Tomatoes 1kg", shop: shops[0]._id, category: "Fresh", price: 35, stock: 80, image: photo("tomatoes"), letter: "T" },
    { name: "Notebook 200pg", shop: shops[2]._id, category: "Stationery", price: 50, stock: 15, image: photo("notebook,stationery"), letter: "N" },
    { name: "Croissant", shop: shops[2]._id, category: "Bakery", price: 40, stock: 25, image: photo("croissant"), letter: "C" },
    { name: "Cough Syrup", shop: shops[1]._id, category: "Medicine", price: 90, stock: 40, image: photo("syrup,medicine"), letter: "C" },
    { name: "Onions 1kg", shop: shops[0]._id, category: "Fresh", price: 30, stock: 60, image: photo("onions"), letter: "O" }
  ]);

  console.log("Seed data inserted successfully with real images and coordinates");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
