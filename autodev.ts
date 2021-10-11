import {getInput, setFailed, info} from '@actions/core'
import {exec} from '@actions/exec';
import { getRepoString, fetchPulls } from './utils';

const run = async (): Promise<void> => {
    const repoString = getRepoString()
    if (!repoString) {
        setFailed("couldn't retrieve the repo string. GITHUB_REPOSITORY not set?")
        return
    }
    const [owner, repo] = repoString.split('/')
    
    const token = getInput('token');
    const optimistic = getInput('optimistic') === "true";
    const pulls = (await fetchPulls(token, owner, repo)).
        filter(pull => pull.labels.some(l => l.name === "dev"))

    if (pulls.length == 0) {
        info("nothing to merge.")
        return
    }

    const branches = pulls.map(pull => pull.head.ref);
    await exec('git config --global user.email "staffbot@staffbase.com"')
    await exec('git config --global user.name "AutoDev Action"')
    await exec('git fetch')
    await exec('git checkout dev')
    await exec('git reset --hard origin/master')
    
    const message = 
        optimistic ?
        await merge(branches) :
        await mergeAll(branches)
 
    await exec('git push -f')
    
    info(message)
}

const merge = async (branches: string[]): Promise<string> => {
    const success = []
    for (const branch of branches) {
        try {
            await exec(`git merge origin/${branch}`)
            success.push(branch)
        } catch (error) {
            info(`encountered merge conflicts with branch "${branch}", error: ${error}`)
            await exec(`git merge --abort`)
        }
    }
    await exec('git reset origin/master')
    await exec('git add -A')

    const message = `AutoDev Merge\n\nThe following branches have been merged:\n${success.map(b => `- ${b}`).join('\n')}`
    await exec('git commit -m', [message])

    return message
}

const mergeAll = async (branches: string[]): Promise<string> => {
    const message = `AutoDev Merge\n\nThe following branches have been merged:\n${branches.map(b => `- ${b}`).join('\n')}`
    await exec(`git merge -s octopus`, [...branches.map(branch => `origin/${branch}`), '--no-ff', '-m', message])
    return message
}

export default run;