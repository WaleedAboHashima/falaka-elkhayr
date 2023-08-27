const mongoose = require("mongoose");

const Categories = mongoose.model(
  "Categories",
  new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    // states: [{ name: { type: String, required: true } }],
    icon: {
      type: String,
      required: true,
    },
  })
);

module.exports = Categories;
