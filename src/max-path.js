/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const path = require('path')
const fsPromises = require('fs/promises')

var dataPath = path.join('C:', 'MAX Data')

var getDirectories = async source =>
  (await fsPromises.readdir(source, { withFileTypes: true }))
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

var projectDirectories = async source =>
  ((await getDirectories(source)).filter(dir => dir.includes('-')))

var currentMonthDirectory = async source =>
((await projectDirectories(source).then(projectDirs => {
  var today = new Date(Date.now())
  var year = today.getFullYear().toString()
  var mon = (today.getMonth() + 1).toString().padStart(2, '0')
  for (var projDir of projectDirs) {
    if (projDir.includes(year + '-' + mon)) {
      return projDir
    }
  }
})))

var todaysDirectory = async source =>
((await currentMonthDirectory(source).then(curMonDir => {
  var today = new Date(Date.now())
  var day = (today.getDate()).toString().padStart(2, '0')
  return path.join(source, curMonDir, day)
})))

var allRuns = async source =>
  ((await getDirectories(source)).filter(dir => dir.includes('#')))

var latestRun = async source =>
((await allRuns(source).then(runs => {
  var runNums = runs.map(run => Number(run.replace('#', '')))
  var largest = runNums[0];
  for (var i = 0; i < runNums.length; i++) {
    if (runNums[i] > largest) {
      largest = runNums[i];
    }
  }
  return ('#' + largest.toString())
})))

var latestDayDirectory =  async source =>
(await currentMonthDirectory(source).then(async curMonDir => {
  var allDays = await getDirectories(path.join(source, curMonDir))
  allDays = allDays.map(day => Number(day))
  console.log('allDays', allDays)
  var largest = allDays[0];
  for (var i = 0; i < allDays.length; i++) {
    if (allDays[i] > largest) {
      largest = allDays[i];
    }
  }
  return path.join(source, curMonDir, largest.toString().padStart(2, '0'))
}))

var latestRunDirectory = async source => {
  var todayDir = await todaysDirectory(source)
  var latestRunDir
  try {
    latestRunDir = await latestRun(todayDir)
  } catch (error) {
    // for multi-day runs, the MAX IR system drops files into the day when stuff started
    // so get the last day in the month directory
    console.log('previous day start')
    todayDir = await latestDayDirectory(source)
    latestRunDir = await latestRun(todayDir)
  }
  return path.join(todayDir, latestRunDir)
}

var latestFile = async source => {
  var files = (await fsPromises.readdir(source, { withFileTypes: true }))
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)

  var latestFile = files[0]
  var latestStats = await fsPromises.stat(path.join(source,latestFile))
  for (var i = 0; i < files.length; i++) {
    var file = files[i]
    var stats = await fsPromises.stat(path.join(source,file))
    if (stats.birthtimeMs > latestStats.birthtimeMs && file.includes('.LAB')) {
      latestFile = file
      latestStats = stats
    }
  }
  return latestFile
}

module.exports = {
  path: dataPath,
  latestRunDirectory: latestRunDirectory,
  latestFile: latestFile,
}
