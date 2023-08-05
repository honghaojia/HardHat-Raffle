const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { network, getNamedAccounts, ethers } = require("hardhat")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", async function () {
          let raffle,
              vrfCoordinatorV2Mock,
              raffleEntranceFee,
              deployer,
              interval,
              raffleAddress
          const chainId = network.config.chainId
          const raffle_interval = networkConfig[chainId]["interval"]

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer,
              )
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
              raffleAddress = await raffle.getAddress()
          })
          describe("constructor", function () {
              it("initalizes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), raffle_interval)
              })
          })
          describe("enterRaffle", function () {
              it("revert when you don't pay enough", async function () {
                  await expect(
                      raffle.enterRaffle(),
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle_NotEnoughETHEntered",
                  )
              })
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.emit(raffle, "RaffleEnter")
              })
              it("dosen's allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })

                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  //   //We pretend to be a chainlink keeper
                  let abicoder = new ethers.AbiCoder()
                  let dataEncoded = abicoder.encode(["uint256[]"], [[1, 2, 3]])
                  await raffle.performUpkeep(dataEncoded)
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle_NotOpen")
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people didn's send any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])

                  const { upkeepNeeded } = await raffle.checkUpkeep("0x")

                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("returns true if raffle is open and has players", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x")
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe("performUpkeep", function () {
              it("it can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("it reverts when checkupkeep is false ", async function () {
                  await expect(
                      raffle.performUpkeep("0x"),
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle_UpkeepNotNeeded",
                  )
              })
              it("updates the raffle state, emits and event , and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)

                  const request_id = txReceipt.logs[1].args.requestId
                  const raffleState = Number(await raffle.getRaffleState())
                  assert(Number(request_id) > 0)
                  assert(raffleState.toString(), "1")
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
              })
              it("it can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffleAddress),
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffleAddress),
                  ).to.be.revertedWith("nonexistent request")
              })
              ///way too big
              it("picks a winner, resets the lottery,and sends some money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 //deployer = 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < additionalEntrants + startingAccountIndex;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                  }
                  const startingTimeStamp = await raffle.getlastTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          try {
                              const recentWinner =
                                  await raffle.getReceneWinner()
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp =
                                  await raffle.getlastTimeStamp()
                              const numPlayers =
                                  await raffle.getNumberOfPlayers()
                              const winnerEndingBlance =
                                  await ethers.provider.getBalance(
                                      accounts[1].address,
                                  )

                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")

                              assert(endingTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBlance.toString(),
                                  (
                                      BigInt(winnerStartingBalance) +
                                      raffleEntranceFee *
                                          BigInt(additionalEntrants + 1)
                                  ).toString(),
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance =
                          await ethers.provider.getBalance(accounts[1].address)
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args.requestId,
                          raffleAddress,
                      )
                  })
              })
          })
      })
