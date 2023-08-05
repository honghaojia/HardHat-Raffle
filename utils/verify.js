const { run } = require("hardhat")

async function verify(contractAdress, args) {
  console.log("Verifying Contract...")
  try {
    await run("verify:verify", {
      address: contractAdress,
      constructorArguments: args,
    })
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!")
    } else {
      console.log(e)
    }
  }
}

module.exports = {
  verify,
}
