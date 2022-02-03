const Lottery = artifacts.require("Lottery");

module.exports = async function (deployer) {
  await deployer.deploy(Lottery);
  const instanceLottery = await Lottery.deployed();
  console.log(instanceLottery);
};