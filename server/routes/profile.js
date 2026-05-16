const Profile = require('../models/Profile');

exports.getAll = async (req, res) => {
  const profile = await Profile.findOne();
  res.json(profile || {});
};

exports.update = async (req, res) => {
  let profile = await Profile.findOne();
  if (!profile) profile = new Profile();
  Object.assign(profile, req.body);
  await profile.save();
  res.json(profile);
};
