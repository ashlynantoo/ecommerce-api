const path = require("path");
const { StatusCodes } = require("http-status-codes");
const Product = require("../models/Product");
const CustomError = require("../errors");

const addProduct = async (req, res) => {
  req.body.createdOrUpdatedBy = req.user.userId;

  const product = await Product.create(req.body);

  res.status(StatusCodes.CREATED).json({ product });
};

const getAllProducts = async (req, res) => {
  const queryObject = {};
  const {
    name,
    category,
    company,
    featured,
    freeShipping,
    numericFilters,
    sort,
    select,
  } = req.query;

  if (name) {
    queryObject.name = { $regex: name, $options: "i" };
  }

  if (category) {
    queryObject.category = category;
  }

  if (company) {
    queryObject.company = company;
  }

  if (featured) {
    queryObject.featured = featured;
  }

  if (freeShipping) {
    queryObject.freeShipping = freeShipping;
  }

  if (numericFilters) {
    const operatorMap = {
      "<": "$lt",
      "<=": "$lte",
      ">": "$gt",
      ">=": "$gte",
      "=": "$eq",
    };
    const regEx = /\b(<|<=|>|>=|=)\b/g;
    const filters = numericFilters.replace(regEx, (match) => {
      return `-${operatorMap[match]}-`;
    });
    const options = ["price", "averageRating"];
    filters.split(",").forEach((item) => {
      const [field, operator, value] = item.split("-");
      if (options.includes(field)) {
        queryObject[field] = { [operator]: Number(value) };
      }
    });
  }

  let result = Product.find(queryObject);

  if (sort) {
    if (sort === "price-low") {
      result = result.sort("price");
    } else if (sort === "price-high") {
      result = result.sort("-price");
    } else if (sort === "a-z") {
      result = result.sort("name");
    } else if (sort === "z-a") {
      result = result.sort("-name");
    }
  } else {
    result = result.sort("name");
  }

  if (select) {
    const selectList = select.split(",").join(" ");
    result = result.select(selectList);
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  result = result.limit(limit).skip(skip);

  const products = await result;

  res.status(StatusCodes.OK).json({ count: products.length, products });
};

const getProduct = async (req, res) => {
  const { id: productId } = req.params;

  const product = await Product.findById(productId).populate("reviews");

  if (!product) {
    throw new CustomError.NotFoundError(`No product with Id ${productId}`);
  }

  res.status(StatusCodes.OK).json({ product });
};

const updateProduct = async (req, res) => {
  req.body.createdOrUpdatedBy = req.user.userId;
  const { id: productId } = req.params;

  const product = await Product.findByIdAndUpdate(productId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw new CustomError.NotFoundError(`No product with Id ${productId}`);
  }

  res.status(StatusCodes.OK).json({ product });
};

const deleteProduct = async (req, res) => {
  const { id: productId } = req.params;

  const product = await Product.findById(productId);

  if (!product) {
    throw new CustomError.NotFoundError(`No product with Id ${productId}`);
  }

  await product.deleteOne();

  res.status(StatusCodes.OK).json({ msg: "Product removed successfully!" });
};

const upLoadProductImage = async (req, res) => {
  if (!req.files) {
    throw new CustomError.BadRequestError("Please upload the image");
  }
  const productImage = req.files.image;
  if (!productImage.mimetype.startsWith("image")) {
    throw new CustomError.BadRequestError("Please upload an image");
  }
  const maxSize = 1024 * 1024; //1MB
  if (productImage.size > maxSize) {
    throw new CustomError.BadRequestError(
      `Please upload an image with size less than 1MB`
    );
  }
  const imagePath = path.join(
    __dirname,
    "../public/uploads/" + `${productImage.name}`
  );
  await productImage.mv(imagePath);

  res
    .status(StatusCodes.OK)
    .json({ image: { src: `/uploads/${productImage.name}` } });
};

module.exports = {
  addProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  upLoadProductImage,
};
