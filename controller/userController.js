import asyncHandler from "express-async-handler";
import generateToken from "../utilis/generateToken.js";
import User from "../models/userModel.js";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// @desc    Auth user & get token
// @routes  POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
      hasError: false,
    });
  } else {
    res.json({
      hasError: true,
      message: "Authentication failed",
    });
  }
});

// @desc    Register a new user
// @routes  POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.json({
      hasError: true,
      message: "User already exist",
    });
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
      message: "User created successfully",
      hasError: false,
    });
  } else {
    res.json({
      hasError: true,
      message: "Invalid User Data",
    });
  }
});

// @desc    Get user profile
// @routes  Get /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Update user profile
// @routes  PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      token: generateToken(updatedUser._id),
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Get all users
// @routes  Get /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// @desc    Delete user
// @routes  DELETE /api/users/:id
// @access  Private/Admin
const deleteUsers = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    await user.remove();
    res.json({ message: "User removed" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Get user by ID
// @routes  Get /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Update user
// @routes  PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.isAdmin = req.body.isAdmin;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// desc forgot password
// roue POST /api/users/forgot

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const existingEmail = await User.findOne({ email });

  if (existingEmail) {
    var transporter = nodemailer.createTransport({
      host: "mail.midraconsulting.com",
      port: 8889,
      secure: false, // upgrade later with STARTTLS
      auth: {
        user: "bobby@midraconsulting.com",
        pass: "1nt3n@t10n@l",
      },
    });

    const token = generateToken(existingEmail._id);

    let data = forgotPasswordTemplate(token);

    const mailOptions = {
      from: "bobby@midraconsulting.com", // sender address
      to: email, // list of receivers
      subject: "RESET PASSWORD", // Subject line
      html: data, // plain text body
    };

    transporter.sendMail(mailOptions, function (err, info) {
      if (err) console.log(err);
      else console.log("");
    });
    res.json({
      hasError: false,
      message: "please check your email for reset link",
    });
  } else {
    res.json({
      message: "User does not exist",
      hasError: true,
    });
  }
});

// Desc Reset Password
// Route POST api/users/reset

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, resetPassword } = req.body;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      res.json({
        hasError: true,
        message: "Error: email not verified",
      });
    }
    const user = await User.findByIdAndUpdate(decoded.id, {
      password: passwordHash,
    });

    if (user) {
      res.json({
        hasError: false,
        user: user,
      });
    } else {
      res.json({
        hasError: true,
        message: "Error: email not verified",
      });
    }
  } else {
    res.json({
      hasError: true,
      message: "Error: please try again",
    });
  }
});

// Desc Change Password
// Route POST api/users/change

const changePassword = asyncHandler(async (req, res) => {
  const { password, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  let match = await user.matchPassword(password);

  if (match) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedPassword = await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
    });

    const changedPassword = await updatedPassword.save();

    res.json({
      changedPassword,
      message: "password changed successfully",
      hasError: false,
    });
  } else {
    res.json({
      hasError: true,
      message: "incorrect password",
    });
  }
});

const forgotPasswordTemplate = (token) => {
  return `
    <html lang="en-US">
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Reset Password Email Template</title>
        <meta name="description" content="Reset Password Email Template.">
        <style type="text/css">
            a:hover {text-decoration: underline !important;}
        </style>
    </head>
    
    <body marginheight="0" topmargin="0" marginwidth="0" style="margin: 0px; background-color: #f2f3f8;" leftmargin="0">
        <!--100% body table-->
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
            style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                              <a style="text-decoration: none" href="https://rakeshmandal.com" title="logo" target="_blank">
                              <p style="font-size: 40px; font-weight: 600; color: #3A8BCD;">MCBEE</p>
                              </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">You have
                                                requested to reset your password</h1>
                                            <span
                                                style="display:inline-block; vertical-align:middle; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                We cannot simply send you your old password. A unique link to reset your
                                                password has been generated for you. To reset your password, click the
                                                following link and follow the instructions.
                                            </p>
                                            <a href="https://mcbee.herokuapp.com/auth/reset-password/${token}"
                                                style="background:#3a8bcd;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">Reset
                                                Password</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                </table>
                            </td>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:14px; color:rgba(69, 80, 86, 0.7411764705882353); line-height:18px; margin:0 0 0;">&copy; <strong>mcbee Inc.</strong></p>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        <!--/100% body table-->
    </body>
    
    </html>
    `;
};

export {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUsers,
  getUserById,
  updateUser,
  forgotPassword,
  resetPassword,
  changePassword,
};
