const router = require('express').Router();
const { AddProduct, GetAllProducts, DeleteProduct, AddSR, GetCustomers, AddTerms } = require('../controllers/adminController');
const imgUploader = require('../middleware/imgUploader');

router.post('/addproduct', imgUploader.fields([{ name: "imgs" ,maxCount:3}]) ,AddProduct);
router.get('/getallproducts', GetAllProducts);
router.delete('/product/:productId', DeleteProduct);
router.post('/addsr', AddSR);
router.get('/users', GetCustomers)
router.post('/terms', AddTerms)
module.exports = router;