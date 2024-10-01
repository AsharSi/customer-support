# routes.py
from flask import Blueprint

main = Blueprint('main', __name__)

@main.route('/test')
def home():
    return "Route is working"

@main.route('/about')
def about():
    return "This is the About Page"
