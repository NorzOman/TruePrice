
#include "../include/crow.h"
#include "../include/json.hpp"

using json = nlohmann::json;

int main(){

    crow::SimpleApp app;
    json db;
    
    CROW_ROUTE(app,"/api/health").methods(crow::HTTPMethod::GET)([](const crow::request &req){
        crow::json::wvalue res;
        try{
            res["status"] = "success";
            res["response"] = "200 Health OK";
            return crow::response(200,res);
        }catch(const std::exception& e){
            res["status"] = "failed";
            res["response"] = e.what();
            return crow::response(500,res);
        }
    });

    CROW_ROUTE(app,"/api/post/price").methods(crow::HTTPMethod::POST)([&db](const crow::request &req){
        crow::json::wvalue res;
        try{
            auto body = crow::json::load(req.body);
            res["status"] = "success";
            if(!body.has("uid") || !body.has("timestamp") || !body.has("price")) {
                res["response"] = "Missing required field";
                return crow::response(400,res);
            }
            std::string uid = body["uid"].s();
            std::string timestamp = body["timestamp"].s();
            std::string price = body["price"].s();
            if(!db.contains(uid)) db[uid] = json::array();
            db[uid].push_back({
                {"timestamp",timestamp},
                {"price",price}
            });
            res["response"] = "Data entered successfully";
            return crow::response(200,res);
        }catch(const std::exception& e){
            res["status"] = "failed";
            res["response"] = e.what();
            return crow::response(500,res);
        }
    });

    CROW_ROUTE(app, "/api/get/price").methods(crow::HTTPMethod::POST)([&db](const crow::request &req){
        crow::json::wvalue res;

        try {
            auto body = crow::json::load(req.body);
            res["status"] = "success";
            if (!body || !body.has("uid")) {
                res["response"] = "Missing required field";
                return crow::response(400, res);
            }
            std::string uid = body["uid"].s();
            if (!db.contains(uid)) {
                res["response"] = "The requested item doesn't have any prices stored yet";
                return crow::response(200, res);
            }
            res["status"] = "success";
            res["response"] = crow::json::load(db[uid].dump()); 

            crow::response r(res);           
            r.set_header("Content-Type", "application/json");
            return r;

        } catch (const std::exception &e) {
            res["status"] = "failed";
            res["response"] = e.what();
            return crow::response(500, res);
        }
    });

    app.port(8000).run();
}