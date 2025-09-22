import datetime
import json
import logging
import os

import jinja2
import webapp2
from google.cloud import ndb
from google.api_core import exceptions as gcloud_exceptions
template_dir = os.path.join(os.path.dirname(__file__), 'html')
jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(template_dir),
    autoescape=True)
# logging.error(template_dir)


ndb_client = ndb.Client()

DEFAULT_USER_ID = 'public'
DEFAULT_ROBOT_ID = 5629499534213120
DEFAULT_ROBOT_FILE = os.path.join(
    os.path.dirname(__file__),
    'testowe',
    'pi_robot_urdf.xml')


def load_default_robot(id_number):
    if id_number != DEFAULT_ROBOT_ID:
        return None
    try:
        with open(DEFAULT_ROBOT_FILE, 'r') as fh:
            urdf_content = fh.read()
    except IOError:
        logging.exception('Default robot asset missing at %s', DEFAULT_ROBOT_FILE)
        return None
    return {
        "urdf": urdf_content,
        "visible": True,
        "id": DEFAULT_ROBOT_ID}


class RobotModel(ndb.Model):
    name = ndb.StringProperty()
    urdf = ndb.TextProperty()
    userid = ndb.StringProperty()
    visible = ndb.BooleanProperty(default=True)
    last_edited = ndb.DateProperty()
    first_edited = ndb.DateProperty()

    def make_safe_dict(self):
        return {
            "urdf": self.urdf,
            "visible": self.visible,
            "id": self.key.id()}


class Handler(webapp2.RequestHandler):
    def write(self, *a, **kw):
        self.response.out.write(*a, **kw)

    def render_str(self, template, **params):
        t = jinja_env.get_template(template)
        return t.render(params)

    def render(self, template, **kw):
        self.write(self.render_str(template, **kw))

    def current_user(self):
        user_id = self.request.headers.get('X-Appengine-User-Id')
        if user_id:
            email = self.request.headers.get('X-Appengine-User-Email')
            nickname = self.request.headers.get('X-Appengine-User-Nickname') or email
            return {
                "id": user_id,
                "email": email,
                "nickname": nickname
            }
        return {
            "id": DEFAULT_USER_ID,
            "email": None,
            "nickname": None
        }


class Robots(Handler):
    '''this handles uploading/downloading robot's urdf'''

    def write_json(self, obj):
        self.response.headers['Content-Type'] = 'application/json'
        self.write(json.dumps(obj))

    def get(self, id_number):  # reading robot
        user = self.current_user()

        id_number = int(id_number)

        try:
            robot = RobotModel.get_by_id(id_number)
        except gcloud_exceptions.GoogleAPICallError:
            logging.exception('Unable to load robot %s from datastore', id_number)
            robot = None

        if not robot:
            fallback_robot = load_default_robot(id_number)
            if fallback_robot:
                self.write_json(fallback_robot)
                return

        current_user_id = user["id"] if user else None
        if robot and (robot.visible or robot.userid == current_user_id):

            obj = robot.make_safe_dict()
            self.write_json(obj)
        else:
            self.error(401)

    def put(self, id_number):  # updating robot
        user = self.current_user()
        try:
            id_number = int(id_number)
        except BaseException:
            id_number = 0
        payload = self.request.body.decode('utf-8') if isinstance(self.request.body, bytes) else self.request.body
        robot_slo = json.loads(payload)

        # has to be right user to edit

        try:
            robot = RobotModel.get_by_id(id_number)
        except gcloud_exceptions.GoogleAPICallError:
            logging.exception('Unable to load robot %s for update', id_number)
            robot = None
        if robot and robot.userid == user["id"]:

            robot.urdf = robot_slo["urdf"]
            robot.visible = robot_slo["visible"]
            robot.last_edited = datetime.datetime.now().date()
            try:
                robot.put()
            except gcloud_exceptions.GoogleAPICallError:
                logging.exception('Unable to update robot %s', id_number)
                self.error(503)
                return
            self.write_json(robot.make_safe_dict())
        else:  # save as new robot for the current user
            robot = RobotModel(userid=user["id"])
            robot.urdf = robot_slo["urdf"]
            robot.visible = robot_slo["visible"]
            robot.userid = user["id"]
            robot.last_edited = datetime.datetime.now().date()
            robot.first_edited = datetime.datetime.now().date()
            logging.error(robot)
            try:
                robot.put()
            except gcloud_exceptions.GoogleAPICallError:
                logging.exception('Unable to create robot for user %s', user["id"])
                self.error(503)
                return
            self.write_json(robot.make_safe_dict())

    def post(self):  # new robot

        user = self.current_user()
        payload = self.request.body.decode('utf-8') if isinstance(self.request.body, bytes) else self.request.body
        robot_slo = json.loads(payload)
        # logging.error("fufu")
        robot = RobotModel(userid=user["id"])
        robot.urdf = robot_slo["urdf"]
        robot.visible = robot_slo["visible"]
        robot.userid = user["id"]
        robot.last_edited = datetime.datetime.now().date()
        robot.first_edited = datetime.datetime.now().date()
        # logging.error(robot)
        try:
            robot.put()
        except gcloud_exceptions.GoogleAPICallError:
            logging.exception('Unable to create robot for user %s', user["id"])
            self.error(503)
            return
        # logging.error(robot.make_safe_dict())
        self.write_json(robot.make_safe_dict())


class AR(Handler):
    '''this will serve a AR-enabled website'''

    def get(self, id_number=5629499534213120):
        self.render("ar.html", robot_start_id=id_number)

    def post(self):
        pass


class MainPage(Handler):
    def get(self, id_number=5629499534213120):
        # self.write("fufufu")
        self.render(
            "index.html",
            linki=[
                ("R2D2",
                 "r2d2.xml"),
                ("PI robot",
                 "pi_robot_urdf.xml")],
            robot_start_id=id_number,
            user_can_edit=True)

    def post(self):
        pass  # safe form
        # user = users.get_current_user()

        # robot_urdf=self.request.get("robottext")
        # robot_csv=self.request.get("animcsv")
        # self.write(robot_urdf)
        # self.write(robot_csv)


class Login(Handler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write('Authentication is currently disabled.')


class NDBMiddleware(object):
    def __init__(self, wsgi_app):
        self._wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        with ndb_client.context():
            return self._wsgi_app(environ, start_response)


wsgi_app = webapp2.WSGIApplication([('/*',
                                      MainPage),
                                     ('/',
                                      MainPage),
                                     ('/robots',
                                      Robots),
                                     ('/robots/(.*)',
                                      Robots),
                                     ('/signup',
                                      Login),
                                     (r'/ar/(.*)',
                                      AR),
                                     (r'/(.*)',
                                      MainPage)],
                                    debug=True)

app = NDBMiddleware(wsgi_app)
