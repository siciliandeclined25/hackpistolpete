############################
##        HACK OSU        ##
##  BY LUCAS JAG AND HEET ##
############################
from flask import Flask, render_template, request
import json, time

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("/index.html")


@app.route("/quiz", methods=["GET"])
def quiz():
    quizData = json.load(
        open("static/quiz/quiz" + request.args.get("id") + ".json", "r")
    )
    return render_template(
        "/quiz.html", quizname="Calculus Review 1", quizID=request.args.get("id")
    )


@app.route("/startquiz")
def startquiz():
    open("session.txt", "w").write(str(time.time()))  # this erates from the beginning
    return 200


@app.route("/quiz")
def quizProblem():
    quizQuestion = json.load(
        open("static/quiz/quiz" + request.args.get("id") + ".json", "r")
    )[str(request.args.get("p"))]
    # string version of question
    return quizQuestion


@app.route("/endquiz", methods=["GET", "POST"])
def endQuiz():
    userResults = (
        request.args.get_json()
    )  # assuming i can iterate through this postdata
    quizToConfirm = json.load(
        open("static/quiz/quiz" + request.args.get("id") + ".json", "r")
    )
    finalScore = 100
    percentage = 100 / len(userResults)  # percent based on len for n amount

    # first get response
    for userResponse in userResults:
        if userResponse[0] != quizToConfirm[0]:
            finalScore -= percentage
    return finalScore


if __name__ == "__main__":
    app.run()
