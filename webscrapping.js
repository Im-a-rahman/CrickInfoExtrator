// the real purpose is to learn how to extract information and get familiar with js
// npm init -y
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

// node webscrapping.js --excel=worldcup.csv --dataDir=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-schedule-fixtures-and-results

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");

let args = minimist(process.argv);
// console.log(args.datafolder);
// console.log(args.excel);
/* download using axios
read using jsdom 
make excel using excel4node
make pdf using pdf-lib  */
let downloadkapromise = axios.get(args.source);
downloadkapromise.then(function(response){
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    //let title = document.title;

    let matches = [];

    let matchInfoDivs = document.querySelectorAll("div.ds-p-4 div.ds-text-compact-xxs");   //.ds-p-4 .ds-text-compact-xxs this gives 48 also
    for( let i=0;i<matchInfoDivs.length;i++){
       let matchdiv = matchInfoDivs[i];
       let match = {
        t1 : "",
        t2 : "",
        t1s : "",
        t2s : "",
        result : ""
       };
       let score = matchdiv.querySelectorAll(".ds-text-compact-s strong");

       if(score.length == 2){
        match.t1s = score[0].textContent;
        match.t2s = score[1].textContent;
       }
       else if( score.length == 1){
        match.t1s = score[0].textContent;
        match.t2s = "";
       }
       else {
        match.t1s = "";
        match.t2s = "";
       }  

       let teams = matchdiv.querySelectorAll("p.ds-text-tight-m" );
       let team1 = teams[0].textContent;
       let team2 = teams[1].textContent;
       
       let result = matchdiv.querySelectorAll("p.ds-text-tight-s"); // we can do this also p.ds-text-tight-s > span
       match.t1 = team1;
       match.t2 = team2;
       match.result = result[0].textContent;
       matches.push(match);


   }
  let matcheskaJson = JSON.stringify(matches);
  fs.writeFileSync("matches.json",matcheskaJson, "utf-8");

  let teams = []
  for(let i=0;i<matches.length;i++){
    adduniqueteams(teams, matches[i].t1);
    adduniqueteams(teams, matches[i].t2);
}
  for(let i =0;i<matches.length;i++){
    addmatchesAtAppropriateplaces(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
    addmatchesAtAppropriateplaces(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);

  }


  let teamsKaJSON = JSON.stringify(teams);
  fs.writeFileSync("teams.json",teamsKaJSON,"utf-8");
  prepareExcel(teams, args.excel);

  createfolderandpdfs(teams,args.dataDir);



})

function createfolderandpdfs(teams, dataDir){

    if(fs.existsSync(dataDir)==true){
     fs.rmdirSync(dataDir,{ recursive:true});

    }
    fs.mkdirSync(dataDir);
 
    for(let i=0;i<teams.length;i++){
        let teamFoldername = path.join(dataDir,teams[i].name);
        if(fs.existsSync(teamFoldername)==false){
            fs.mkdirSync(teamFoldername);
        }


        for(let j=0;j<teams[i].matches.length;j++){
            let match = teams[i].matches[j];
            let hometeam = teams[i].name;
            createScoreCardpdf(teamFoldername, hometeam, match)
        }
    }

}
function createScoreCardpdf(teamFoldername, hometeam, match){
    let matchFileName = path.join(teamFoldername, match.vs);

    let templateFilebytes = fs.readFileSync("template.pdf");
    let pdfDocKaPromise = pdf.PDFDocument.load(templateFilebytes);
     pdfDocKaPromise.then(function(pdfdoc){
    let page = pdfdoc.getPage(0);


        page.drawText(hometeam, {
            x: 320,
            y : 610,
            size : 12
        });
        page.drawText(match.vs, {
            x: 320,
            y : 590,
            size : 12
        });
        page.drawText(match.selfscore, {
            x: 320,
            y : 570,
            size : 12
        });
        page.drawText(match.oppScore, {
            x: 320,
            y : 555,
            size : 12
        });
        page.drawText(match.result, {
            x: 300,
            y : 533,
            size : 10
        });
        let changedByteskapromise = pdfdoc.save();
        changedByteskapromise.then(function(changedBytes){
            
            if(fs.existsSync(matchFileName + ".pdf")==true){
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            }
            else {
                fs.writeFileSync(matchFileName +".pdf",changedBytes);
            }
        })

    })
}

function prepareExcel(teams, excelFilename){
    let wb = new excel4node.Workbook();
    for(let i=0;i<teams.length;i++){
        let tsheet = wb.addWorksheet(teams[i].name);
        tsheet.cell(1,1).string("vs");
        tsheet.cell(1,2).string("self score");
        tsheet.cell(1,3).string("opp score");
        tsheet.cell(1,4).string("result");
        for(let j=0;j<teams[i].matches.length;j++){
            tsheet.cell(2+j,1).string(teams[i].matches[j].vs);
            tsheet.cell(2+j,2).string(teams[i].matches[j].selfscore);
            tsheet.cell(2+j,3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2+j,4).string(teams[i].matches[j].result);

        }

    }
    wb.write(excelFilename);
}

function adduniqueteams(teams,teamName){
    let tidx = -1 ;
    for(let i=0;i<teams.length;i++){
        if(teams[i].name == teamName){
            tidx = i;
            break;
        }
    }
    if(tidx == -1){
        teams.push({
            name : teamName,
            matches : []
        })
    }
}
function addmatchesAtAppropriateplaces(teams, hometeam, oppteam, homescore, oppscore, result){
    let tidx = -1;
    for(let i =0;i<teams.length;i++){
       if(teams[i].name == hometeam){
        tidx = i;
        break;
       } 
    }
    let team = teams[tidx];
    team.matches.push({
        vs : oppteam,
        selfscore : homescore,
        oppScore : oppscore,
        result : result
    })

    }

  