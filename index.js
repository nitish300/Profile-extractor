const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const csv = require('csvtojson');
const { parse } = require('json2csv');
const csvFilePath = './Profile Data.csv';
const constants = require(`./excelKeys.js`);


let githubKey;
let leetCodeKey;
let codechefKey;

async function automate(csvFilePath) {
    try {

        const browser = await puppeteer.launch({
            headless: false,
            slowMo: 30, // for slowing a bit 
            defaultViewport: null, // null the default viewport 
            args: ["--start-maximized"], // for full screen
        });
        console.log('Launched......');

        // Async / await usage
        const jsonArray = await csv().fromFile(csvFilePath);
        // console.log(jsonArray);

        if (!jsonArray || jsonArray.length == 0) {
            console.log('Null or Empty!!');
            return;
        }

        updateKeys(jsonArray);

        const page = (await browser.pages())[0];

        for (let i in jsonArray) {

            // trying to scrap the github data from link 
            if (jsonArray[i]) { // if non empty or not null 

                // we are passing the json and as it is passed by reference, we are appending data in it to make our works easy 
                await gitScrapper(browser, page, jsonArray[i], githubKey);
                // array updated with Github Contents
                // console.log(jsonArray[i]);

                // scrap leetcode details
                await leetcodeScrap(page, jsonArray[i], leetCodeKey);

                // scrap codechef
                await codechefScrap(page, jsonArray[i], codechefKey);

            }
        }

        // after completing all the stuffs, we will creae a new csv file and add it 

        // now converting final data to csv
        const fields = Object.keys(jsonArray[0]);
        jsonArray.sort(getSortOrder(constants.leetcodeNoOfQuestions));
        const opts = { fields };

        try {
            const csv = parse(jsonArray, opts);
            fs.writeFileSync('./dataModify.csv', csv);

            console.log(chalk.greenBright('Bravo!! Your data is now processed, click to open it'));
            console.log(`./dataModify.csv`);
        } catch (err) {
            console.error(err);
        }

        await browser.close();
        return jsonArray;
    } catch (e) {
        console.log(e);
        return undefined;
    }
}

async function codechefScrap(page, user, codechefKey) {
    if (user[codechefKey]) {
        try {

            console.log(chalk.greenBright('Extracting codechef details'));
            await page.goto(user[codechefKey]);
            await page.waitForSelector('.rating-star');

            let ratingStars = await page.evaluate(() => {
                return document.querySelector('.rating-star').childElementCount
            })

            let ratings = await page.evaluate(() => {
                let ratings = document.querySelector('div.rating-number');
                return Number(ratings.innerText)
            });
            console.log(ratings);

            if (ratings == 0) {
                ratingStars = 0;
            }

            await page.waitForSelector('.rating-data-section .content h5');
            let problemsSolved = await page.evaluate(() => {
                let solved = document.querySelector('.rating-data-section .content h5').innerText.split(" ")[2];
                solved = solved.slice(1, -1);
                return Number(solved);
            });

            user[constants.codechefRating] = ratings;
            user[constants.codechefStars] = ratingStars;
            user[constants.codechefQSolved] = problemsSolved;

            console.log(`Codefhef rating is ${user[constants.codechefRating]}`);
            console.log(`Codechef Stars is ${user[constants.codechefStars]}`);
            console.log(`Codechef questions solved ${user[constants.codechefQSolved]}`);

        } catch (e) {
            console.log(e);
            user[constants.codechefRating] = 0;
            user[constants.codechefStars] = 0;
            user[constants.codechefQSolved] = 0;
        }
    } else {
        user[constants.codechefRating] = 0;
        user[constants.codechefStars] = 0;
        user[constants.codechefQSolved] = 0;
    }
}

async function leetcodeScrap(page, user, leetCodeKey) {
    // goto leetcode profile 
    if (user[leetCodeKey]) {
        try {
            await page.goto(user[leetCodeKey]);
            await page.waitForSelector('.ant-card-head-title');

            let { noOfSumbssions, questionsSolved, acceptance } = await page.evaluate((user, constants) => {
                let submmisions = document.querySelectorAll('.ant-card-head-title');
                submmisions = submmisions[3];
                let noOfSumbssions = Number((submmisions.innerText.split(" "))[0]);

                let toalQuestionsSolvedSelector = document.querySelector('div.total-solved-count__2El1');
                let questionsSolved = Number(toalQuestionsSolvedSelector.innerText);

                let codeAcceptanceSelector = document.querySelector('.css-1b3bb7o-PercentNumber');
                let acceptance = (codeAcceptanceSelector.innerText);


                return { noOfSumbssions, questionsSolved, acceptance }
            });

            // if user has attended any constants, then only it will have contest tag 
            await page.waitForSelector('.css-57z4bo-StatisticWrapper');
            let contestAttended = await page.evaluate(() => {
                let contestSelector = document.querySelector('.css-57z4bo-StatisticWrapper');
                let flag = contestSelector.innerText.includes('Contest Rating');
                if (flag) {

                    let contestSelector = document.querySelectorAll('.css-x9b7oa')[1];
                    let contestAttended = Number(contestSelector.innerText);
                    return contestAttended;
                } else {
                    return 0;
                }
            });
            // now we have the data, lets add it to user's json
            console.log('Leetcode Details');
            console.log(`Submissions: ${noOfSumbssions}`);
            console.log(`Questions Solved: ${questionsSolved}`);
            console.log(`Contest Attended: ${contestAttended}`);
            console.log(`Code Acceptance: ${acceptance}`);
            user[constants.totalSubbmissions] = noOfSumbssions;
            user[constants.leetcodeNoOfQuestions] = questionsSolved;
            user[constants.leetcodeContest] = contestAttended;
            user[constants.codeAcceptance] = acceptance;
        } catch (e) {
            console.log(e);
            user[constants.totalSubbmissions] = 0;
            user[constants.leetcodeNoOfQuestions] = 0;
            user[constants.leetcodeContest] = 0;
            user[constants.codeAcceptance] = 0;
        }
    } else {
        user[constants.totalSubbmissions] = 0;
        user[constants.leetcodeNoOfQuestions] = 0;
        user[constants.leetcodeContest] = 0;
        user[constants.codeAcceptance] = 0;
    }
}

function updateKeys(jsonArray) {
    for (let key in jsonArray[0]) {
        let validate = key.toLowerCase();
        if (validate.includes('github')) {
            githubKey = key;
        } else if (validate.includes('leetcode')) {
            leetCodeKey = key;
        } else if (validate.includes('codechef')) {
            codechefKey = key;
        }
    }
}

//Comparer Function    
function getSortOrder(prop) {
    return function(a, b) {
        if (!a[prop]) {
            return 1;
        } else if (!b[prop]) {
            return -1;
        } else {
            return b[prop] - a[prop]
        }
    }
}

async function gitScrapper(browser, page, user, githubKey) {

    if (user[githubKey]) {

        try {

            console.log(chalk.blue(`Extracting Github Details for ${user['Name']}`));
            await page.goto(`${user[githubKey]}`);

            // extract contribution 
            await page.waitForSelector('.js-yearly-contributions h2');
            let contribution = await page.evaluate(() => {
                let contribution = document.querySelector('.js-yearly-contributions h2');
                return Number(contribution.innerText.split(" ")[0]);
            })

            console.log(chalk.green(`Contribution In Last Year: ${contribution}`));
            // if user have pinned repositories which are not forked from other then extract them 

            await page.waitForSelector('.pinned-item-list-item', { timeout: 5000 });

            let top5Repo = await page.evaluate(() => {

                let repo = [];
                let elements = document.querySelectorAll('.pinned-item-list-item.source a span');
                if (elements.length == 0)
                    return repo;

                elements.forEach((ele) => {
                    repo.push(ele.innerText.trim())
                })

                return repo.slice(0, 5);
            });

            // if not top5, then we have to extract from all repositories section
            let isContains5 = top5Repo.length == 5;


            // goto Repositories section 
            let repositorySection = (await page.$$('.UnderlineNav-item'))[1];
            await Promise.all([repositorySection.click(), page.waitForNavigation()]);

            await page.waitForSelector('#user-repositories-list li.source', { visible: true, timeout: 5000 });
            let totalRepositories = await page.evaluate(() => {
                let allPersonalRepo = document.querySelectorAll('#user-repositories-list li.source')
                return allPersonalRepo.length;
            })

            console.log(chalk.green("Number of repositories: " + totalRepositories));

            // if length is less than 5, then we need to fetch repo name from users repo 
            if (!isContains5) {
                // if user havn't pinned their top5 repos, then extract the remaing from all repositories section
                top5Repo = await getFirst5RepoForUser(top5Repo, page, `#user-repositories-list li.source .d-inline-block h3`);

            }
            console.log(chalk.green(`Top 5 repositories: ${top5Repo}`));

            // now we need to extract the languages that user had used 
            let languagesUsed = await page.evaluate(() => {
                let spanTag = document.querySelectorAll('#user-repositories-list li.source .d-inline-block span[itemprop="programmingLanguage"]');
                const langsUsed = new Set();
                spanTag.forEach((e) => {
                    langsUsed.add(e.innerText.trim());
                })
                return Array.from(langsUsed);
            });

            console.log(chalk.green(`Languages used are: ${languagesUsed}`));

            // all done 
            user[constants.noOfRepo] = Number(totalRepositories);
            user[constants.contribution] = Number(contribution);
            user[constants.gitRepo] = top5Repo.join(', ');
            user[constants.knownLanguages] = languagesUsed.join(', ');

            return user;
        } catch (e) {
            user[constants.noOfRepo] = 0;
            user[constants.contribution] = 0;
            user[constants.gitRepo] = '';
            user[constants.knownLanguages] = '';

            console.log(chalk.red(e));
            return { error: "Error Occured" }
        }
    } else {
        user[constants.noOfRepo] = 0;
        user[constants.contribution] = 0;
        user[constants.gitRepo] = '';
        user[constants.knownLanguages] = '';

    }
}


async function getFirst5RepoForUser(top5Repo, page, selector) {
    return await page.evaluate((top5Repo, selector) => {
        let repo = [];
        let allRepoHeadings = document.querySelectorAll(`${selector}`);
        if (allRepoHeadings.length == 0)
            return repo;

        allRepoHeadings.forEach((ele) => {
            repo.push(ele.innerText.trim())
        })

        repo.forEach((ele) => {
            if (top5Repo.length < 5 && !top5Repo.includes(ele)) {
                top5Repo.push(ele);
            }
        })
        return top5Repo;
    }, top5Repo, selector);
}

module.exports = automate;
// automate(`${csvFilePath}`);