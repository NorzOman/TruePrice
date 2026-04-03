
from flask import Flask , request

app  = Flask(__name__)

db = {}

@app.route('/api/health',methods=['GET'])
def health():
    return {"status":"success","response":"200 Health OK"}


@app.route('/api/post/price',methods=['POST'])
def updatePrice():
    try:
        data = request.get_json()
        uid = data.get('uid')
        timestamp = data.get('timestamp')
        price = data.get('price')
        
        if uid is None or timestamp is None or price is None:
            return {"status":"error","response":"Missing feilds in the json body"}
        
        if uid not in db:
            db[uid] = []

        db[uid].append({
            "timestamp" : timestamp,
            "price" : price
        })
        return {"status":"success","response":"Data entered succesfully"}        
    except Exception as e:
        return {"status":"error","response":str(e)}


@app.route('/api/get/price',methods=['POST'])
def getPrice():
    try:
        data = request.get_json()
        uid = data.get('uid')
        if uid is None:
            return {"status":"error","response":"Missing feilds in the json body"}
        return {"status":"success","response":db[uid]}        

    except Exception as e:
        return {"status":"error","response":str(e)}


@app.route('/api/admin/dump',methods=['GET'])
def dumpAll():
    return {"status":"success","response":db}


app.run(host='0.0.0.0',port=8000,debug=True)