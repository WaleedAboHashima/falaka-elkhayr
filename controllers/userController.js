const asyncHandler = require("express-async-handler");
const Store = require("../models/Stores");
const User = require("../models/User");
const Categories = require("../models/Categories");
const Rules = require("../models/Rules");
const Order = require("../models/Orders");
const bcrypt = require("bcrypt");
const ApiError = require("../utils/ApiError");
const Product = require("../models/Products");
const Cart = require("../models/Cart");
const Reports = require("../models/Report");

// Profile

exports.GetCategories = asyncHandler(async (req, res, next) => {
  try {
    await Categories.find({}).then((categories) => {
      res.status(200).json({ categories });
    });
  } catch (e) {
    res.status(500).json({message: "Server Error" + e});
  }
});

// Orders

exports.AddOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { name, description, price, totalPrice, quantity } = req.body;
  if (!name || !description || !price || !totalPrice || !quantity) {
    res.status(403).json({ message: "All Fields are required." });
  } else {
    await Order.create({
      name,
      description,
      price,
      totalPrice,
      quantity,
      user: userId,
    }).then((order) => {
      res.status(201).json(order);
    });
  }
});

exports.GetOrderHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  if (!userId) {
    res.status(400).json({ message: "User Id Required." });
  } else {
    const foundUser = await Order.find({ user: userId });
    if (foundUser) {
      const orders = foundUser.map((order) => {
        const { __v, updatedAt, user, ...orders } = order._doc;
        return orders;
      });
      res.status(200).json({ orderDetails: orders });
    } else {
      res.status(404).json({ message: "User Not Found." });
    }
  }
});

// Products & Stores

exports.GetStores = asyncHandler(async (req, res) => {
  const { government, state } = req.body;
  if (!government || !state) {
    res.status(403).json({ message: "All fields are required." });
  } else {
    try {
      const stores = await Store.find({ government, location: state });
      if (stores) {
        const storesWithoutPassword = stores.map((store) => {
          const { __v, password, products, ...storesWithoutPassword } =
            store._doc;
          return storesWithoutPassword;
        });
        res.status(200).json({ Stores: storesWithoutPassword });
      } else {
        res.status(200).json([]);
      }
    } catch (err) {
      res.status(403).json({ message: err });
    }
  }
});

exports.GetNearStores = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const { government, location } = req.body;
  if (!government || !location)
    res.status(403).json({ message: "All fields are required." });
  if (!id) {
    res.status(403).json({ message: "User Id is required." });
  } else {
    try {
      const user = await User.findById({ _id: id });
      if (!user) {
        res.status(404).json({ message: "User does not exist." });
      } else {
        const stores = await Store.find({ location, government });
        if (stores) {
          const storesWithoutPassword = stores.map((store) => {
            const { __v, password, ...storesWithoutPassword } = store._doc;
            return storesWithoutPassword;
          });
          res.status(200).json({ Stores: storesWithoutPassword });
        } else {
          res
            .status(404)
            .json({ message: "No stores found with this location." });
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
});

exports.GetAllStoreProductsAndCategory = asyncHandler(
  async (req, res, next) => {
    const { storeId } = req.params;
    if (!storeId)
      return res.status(403).json({ message: "Store Id Required." });
    else {
      const products = await Product.find({ store: storeId });
      const categories = await Product.distinct("category", { store: storeId });
      if (!products)
        res
          .status(404)
          .json({ message: "There is no store for this product." });
      else {
        res.status(200).json({ products: products, categories: categories });
      }
    }
  }
);

exports.GetProduct = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  if (productId.length === 10)
    res.status(403).json({ message: "Product Id Required." });
  else {
    const product = await Product.findById(productId).populate({
      path: "store",
      select: "-__v -password -products -role",
    });
    if (!product) res.status(404).json({ message: "Product not found." });
    else {
      delete product._doc.__v;
      res.status(200).json({ product });
    }
  }
});

//Carts
exports.AddToCart = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { productId } = req.query;
  const { size } = req.body;
  const product = await Product.findById(productId);
  if (!size) res.status(400).json({ message: "Size Required." });
  else {
    if (!product) res.status(404).json({ message: "Product not found." });
    else {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        const newProduct = {
          ...product.toObject(),
          quantity: 1,
          price: product.price,
          totalPrice: 1 * product.price,
          sizes: [size],
        };
        await Cart.create({ user: userId, products: [newProduct] }).then(
          (cart) => res.status(201).json(cart)
        );
      } else {
        const index = cart.products.findIndex(
          (p) => p._id.toString() === productId && p.sizes.includes(size)
        );
        if (index >= 0) {
          const productToUpdate = cart.products[index];
          await Cart.findByIdAndUpdate(cart._id, {
            $set: {
              [`products.${index}.quantity`]: (productToUpdate.quantity += 1),
              [`products.${index}.totalPrice`]:
                productToUpdate.quantity * product.price,
            },
          });
          res.sendStatus(200);
        } else {
          const newProduct = {
            ...product.toObject(),
            quantity: 1,
            price: product.price,
            totalPrice: 1 * product.price,
            sizes: [size],
          };
          cart.products.push(newProduct);
          await cart.save();
          res.sendStatus(200);
        }
      }
    }
  }
});

exports.GetCart = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const cart = await Cart.findOne({ user: userId });
  if (cart) {
    let cartTotalPrice = 0;
    cart.products.forEach((p) => {
      cartTotalPrice += p.totalPrice;
      delete p.totalPrice;
    });
    cart.totalPrice = cartTotalPrice;
    await cart.save();
    res.status(200).json(cart);
  } else {
    res.status(200).json({ products: [] });
  }
});

exports.DeleteCart = asyncHandler(async (req, res, next) => {
  const { cartId } = req.params;
  const cart = await Cart.findById(cartId);
  if (cart) {
    await Cart.findByIdAndRemove(cartId);
    res.sendStatus(200);
  } else {
    res.status(404).json({ message: "Cart not found" });
  }
});

exports.DeleteProductFromCart = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { productId } = req.params;
  const { size } = req.body;
  if (!size) {
    res.status(403).json({ message: "Size is required." });
  } else {
    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        res.status(404).json({ error: "Cart not found." });
      } else {
        const productIndex = cart.products.findIndex(
          (p) => p._id.toString() === productId && p.sizes.includes(size)
        );
        if (productIndex === -1) {
          res.status(404).json({ message: `Product not found in cart.` });
        } else {
          cart.products.splice(productIndex, 1);
          if (cart.products.length === 0) {
            await Cart.findByIdAndDelete(cart._id);
          } else {
            await cart.save();
          }
          res.json({
            message: `Product was removed from cart.`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: `Error removing product with ID ${productId} from cart.`,
      });
    }
  }
});

exports.ChangeQuantity = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { productId } = req.params;
  const { size, type } = req.body;
  if (!size || !type) {
    res.status(403).json({ message: "All fields are required." });
  } else {
    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        res.status(404).json({ message: "Cart not found" });
      } else {
        const productIndex = cart.products.findIndex(
          (p) => p._id.toString() === productId && p.sizes.includes(size)
        );
        if (productIndex === -1) {
          res.status(404).json({ message: "Product Not Found" });
        } else {
          const product = cart.products[productIndex];
          if (type === "+") {
            const newQuantity = product.quantity + 1;
            await Cart.updateOne(
              {
                _id: cart._id,
                "products._id": product._id,
                "products.sizes": product.sizes[0],
              },
              {
                $set: {
                  "products.$.quantity": newQuantity,
                  "products.$.totalPrice": newQuantity * product.price,
                },
              }
            );
            res.sendStatus(200);
          } else {
            const newQuantity = product.quantity - 1;
            if (newQuantity === 0) {
              const product = cart.products.filter(
                (p) => p._id.toString() === productId
              );
              cart.products.pop(product[0]);
              cart.save();
              res.sendStatus(200);
            } else {
              await Cart.updateOne(
                {
                  _id: cart._id,
                  "products._id": product._id,
                  "products.sizes": product.sizes[0],
                },
                {
                  $set: {
                    "products.$.quantity": newQuantity,
                    "products.$.totalPrice": newQuantity * product.price,
                  },
                }
              );
              res.sendStatus(200);
            }
          }
        }
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Error changing quantity." });
    }
  }
});

exports.DeleteOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  try {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (order) {
      await order.deleteOne();
      res.sendStatus(200);
    } else {
      res.status(404).json({ message: "Order not found." });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
