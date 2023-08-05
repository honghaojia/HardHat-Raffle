const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { network, getNamedAccounts, ethers } = require("hardhat")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", async function () {
          let raffle, raffleEntranceFee, deployer, raffle_address

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffle_address = await raffle.getAddress()
              raffleEntranceFee = await raffle.getEntranceFee()
          })
          describe("fulfillRandomwords", async function () {
              this.timeout(120000)
              it("works with live chainlink keepers and chainlink VRF , we get a random winner", async function () {
                  //enter the raffle
                  const startingTimeStamp = await raffle.getlastTimeStamp()

                  //listener when winner picked
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async function () {
                          console.log("winnerpicked event fired !")
                          try {
                              const recentWinner =
                                  await raffle.getReceneWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBlance =
                                  await ethers.provider.getBalance(
                                      raffle_address,
                                  )
                              const endingTimeStamp =
                                  await raffle.getlastTimeStamp()
                              assert.equal(
                                  recentWinner.toString(),
                                  deployer.toString(),
                              )
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(
                                  winnerEndingBlance.toString(),
                                  (
                                      winnerStartingBalance + raffleEntranceFee
                                  ).toString(),
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      //   Then enter the raffle
                      await raffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                      console.log("test has begin !!! ")

                      const winnerStartingBalance =
                          await ethers.provider.getBalance(raffle_address)
                      console.log("funded the money successfully !!!")
                      //and the code WONT complete until our listener has finished listening!
                  })
              })
          })
      })
