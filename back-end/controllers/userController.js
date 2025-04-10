const asyncHandler = require('../middleware/asyncHandler');
const models = require('../models'); // mengambil models dari models/index.js
const User = models.User;
const bcrypt = require('bcryptjs');
const {createAccounts} = require('../services/accountServices');
// ambil semua data user previlege admin
const allUser = asyncHandler(async (req, res) => {
  const users = await User.find();
  res.status(200).json({
    status: 'success',
    messsage: 'all user:',
    data: users,
  });
});

// ambil data user secara lengkap berdasarkan id
const getUserById = asyncHandler( async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({status: 'fail', message: 'User tidak ditemukan'});
    }

    res.json({status: 'success', message: 'data user berhasil diambil', data: user});
  } catch (error) {
    console.error(error);
    res.status(500).json({status: 'fail', message: 'Terjadi kesalahan server'});
  }
});

// UPDATE USER {name, email}
const updateUserHandler = asyncHandler( async (req, res) => {
  try {
    const {id} = req.params;
    const {name} = req.body;
    // Cek apakah request body kosong
    if ( !name) {
      return res.status(400).json({status: 'fail', message: 'field name harus di isi', error: `name: ${name}`});
    }

    const updatedAt = new Date().toISOString();

    // membuat penyimpanan data sementara
    const updateData = {};
    if (name) updateData.name = name;
    updateData.updatedAt = updatedAt;

    // update user di mongodb
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) return res.status(404).json({status: 'fail', message: 'User tidak ditemukan'});

    res.json({status: 'success', message: 'Profil berhasil diperbarui', data: updatedUser});
  } catch (error) {
    res.status(500).json({status: 'fail', message: 'Terjadi kesalahan', error: error.message});
  }
});

const updatePasswordHandler = asyncHandler( async (req, res) => {
  try {
    const id = req.user._id;
    console.log('id : ' + id);
    const {oldPassword, newPassword} = req.body;

    // cari user berdasarkan id
    const user = await User.findById(id);
    if (!user) return res.status(404).json({status: 'fail', message: 'User tidak ditemukan'});

    // Cek apakah password lama benar
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({status: 'fail', message: 'Password lama salah'});

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // menyimpan password baru
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({status: 'success', message: 'Password berhasil diperbarui'});
  } catch (error) {
    res.status(500).json({status: 'fail', message: 'Terjadi kesalahan', data: error.message});
  }
});


const deleteUserByIdHandler = asyncHandler(async (req, res) => {
  try {
    const {id} = req.params;

    // Cari dan hapus user
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'User tidak ditemukan',
      });
    }

    // Hapus semua dokumen lain yang punya field user_id = id
    const deletePromises = [];

    for (const [name, model] of Object.entries(models)) {
      if (name === 'User') continue;

      if (model.schema?.paths?.user_id) {
        deletePromises.push(model.deleteMany({user_id: id}));
      }
    }

    await Promise.all(deletePromises);

    // Hapus cookie JWT
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      status: 'success',
      message: `User ${deletedUser.name} dan semua data terkait berhasil dihapus`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'fail',
      message: 'Terjadi kesalahan',
      error: error.message,
    });
  }
});

const createAccountsByRoleHandler = asyncHandler( async (req, res) => {
  const userId = req.params.id;
  const {bidangUsaha} = req.body;
  const result = await createAccounts(userId, bidangUsaha);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

module.exports = {allUser, getUserById, updateUserHandler, updatePasswordHandler,
  deleteUserByIdHandler, createAccountsByRoleHandler};
