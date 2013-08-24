// Generated by CoffeeScript 1.6.1
(function() {
  var _this = this,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  window.App = window.App || {};

  App.el2array = function(el, def, check, delim) {
    var arrayw, el2array;
    if (def == null) {
      def = "0 0 0";
    }
    if (check == null) {
      check = true;
    }
    if (delim == null) {
      delim = " ";
    }
    el2array = (check && el) || def;
    arrayw = el2array.split(delim);
    arrayw = _.map(arrayw, function(num) {
      return num * 1;
    });
    return arrayw;
  };

  App.RobotJoint = (function(_super) {

    __extends(RobotJoint, _super);

    function RobotJoint() {
      var _this = this;
      this.movejoint = function(t1, t2) {
        return RobotJoint.prototype.movejoint.apply(_this, arguments);
      };
      this.jointogether = function() {
        return RobotJoint.prototype.jointogether.apply(_this, arguments);
      };
      return RobotJoint.__super__.constructor.apply(this, arguments);
    }

    RobotJoint.prototype.initialize = function() {
      var axis, basicMatrix, position, rotation;
      this.theta = 0;
      this.name = this.attributes.name;
      axis = App.el2array(_.has(this.attributes, "axis") && this.attributes.axis.xyz, "1 0 0");
      this.axis = new THREE.Vector3(axis[0], axis[1], axis[2]);
      rotation = App.el2array(_.has(this.attributes, "origin") && this.attributes.origin.rpy, "0 0 0");
      this.basicrotation = new THREE.Vector3(rotation[0], rotation[1], rotation[2]);
      position = App.el2array(_.has(this.attributes, "origin") && this.attributes.origin.xyz, "0 0 0");
      this.basicposition = new THREE.Vector3(position[0], position[1], position[2]);
      this.lower = (_.has(this.attributes, "limit") && this.attributes.limit.lower) || -Math.PI;
      this.upper = (_.has(this.attributes, "limit") && this.attributes.limit.upper) || Math.PI;
      this.lower = this.lower * 1;
      this.upper = this.upper * 1;
      basicMatrix = new THREE.Matrix4();
      this.movementMatrix = new THREE.Matrix4();
      basicMatrix.setRotationFromEuler(this.basicrotation);
      basicMatrix.setPosition(this.basicposition);
      this.basicMatrix = basicMatrix;
      this.currentMatrix = new THREE.Matrix4();
      this.type = this.attributes.type;
      this.on("change:linkcollection", this.jointogether);
      return this;
    };

    RobotJoint.prototype.jointogether = function() {
      var child, parent;
      if (_.has(this.attributes, "parent") && _.has(this.attributes, "child") && _.has(this.attributes, "linkcollection")) {
        child = this.get("linkcollection").get(this.attributes.child.link);
        parent = this.get("linkcollection").get(this.attributes.parent.link);
        this.parentobject3d = parent.get("link");
        this.childobject3d = child.get("link");
        this.parentobject3d.add(this.childobject3d);
        this.childobject3d.matrixAutoUpdate = false;
        return this.childobject3d.matrix = this.basicMatrix;
      }
    };

    RobotJoint.prototype.movejoint = function(t1, t2) {
      var tempMatrix, tempaxis;
      t1 = t1 || this.theta;
      tempMatrix = new THREE.Matrix4();
      tempaxis = new THREE.Vector3().copy(this.axis);
      if (this.type === "continuous" || ((this.upper > t1 && t1 > this.lower))) {
        switch (this.type) {
          case "revolute":
            this.movementMatrix = tempMatrix.rotateByAxis(this.axis, t1);
            break;
          case "continuous":
            this.movementMatrix = tempMatrix.rotateByAxis(this.axis, t1);
            break;
          case "prismatic":
            this.movementMatrix = tempMatrix.translate(tempaxis.multiplyScalar(t1));
            break;
          case "fixed":
            this.movementMatrix.identity();
            break;
          case "planar":
            this.movementMatrix.identity();
        }
        this.theta = t1;
      } else {
        this.movementMatrix.identity();
      }
      this.currentMatrix.multiplyMatrices(this.basicMatrix, this.movementMatrix);
      this.childobject3d.matrix = this.currentMatrix;
      return this;
    };

    return RobotJoint;

  })(Backbone.Model);

  App.RobotLink = (function(_super) {

    __extends(RobotLink, _super);

    function RobotLink() {
      var _this = this;
      this.clearthislink = function() {
        return RobotLink.prototype.clearthislink.apply(_this, arguments);
      };
      return RobotLink.__super__.constructor.apply(this, arguments);
    }

    RobotLink.prototype.initialize = function() {
      var link;
      this.robotBaseMaterial = new THREE.MeshPhongMaterial({
        color: 0x6E23BB,
        specular: 0x6E23BB,
        shininess: 10
      });
      this.id = this.get("name");
      this.makeobject3d();
      link = new THREE.Object3D();
      link.name = this.get("name");
      link.add(this.meshvis);
      this.set("link", link);
      return this;
    };

    RobotLink.prototype.makeobject3d = function() {
      var boxsize, color, length, orientation, position, radius;
      if (_.has(this.attributes, "visual")) {
        if (_.has(this.attributes.visual, "material")) {
          color = this.get("materialcollection").get(this.attributes.visual.material.name).get("color");
          this.robotBaseMaterial.color = color;
          this.robotBaseMaterial.specular = color;
          this.robotBaseMaterial.color = color;
        }
        if (_.has(this.attributes.visual.geometry, "box")) {
          boxsize = App.el2array(this.attributes.visual.geometry.box.size, "0 0 0");
          this.makebox(boxsize);
        } else if (_.has(this.attributes.visual.geometry, "cylinder")) {
          length = this.attributes.visual.geometry.cylinder.length || 0;
          radius = this.attributes.visual.geometry.cylinder.radius || 0;
          this.makecylinder(length, radius);
        } else if (_.has(this.attributes.visual.geometry, "sphere")) {
          radius = this.attributes.visual.geometry.sphere.radius || 0;
          this.makesphere(radius);
        } else {
          this.makeempty();
        }
        position = App.el2array(_.has(this.attributes.visual, "origin") && this.attributes.visual.origin.xyz, "0 0 0");
        orientation = App.el2array(_.has(this.attributes.visual, "origin") && this.attributes.visual.origin.rpy, "0 0 0");
        this.meshvis.position.set(position[0], position[1], position[2]);
        this.meshvis.rotation.set(orientation[0], orientation[1], orientation[2]);
        return this;
      } else {
        console.log("there are no visual attributes");
        this.makeempty();
        return this;
      }
    };

    RobotLink.prototype.makecylinder = function(length, radius) {
      var meshvis;
      meshvis = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 500, 1), this.robotBaseMaterial);
      meshvis.rotation = new THREE.Vector3(Math.PI / 2, 0, 0);
      this.meshvis = new THREE.Mesh();
      return this.meshvis.add(meshvis);
    };

    RobotLink.prototype.makebox = function(boxsize) {
      return this.meshvis = new THREE.Mesh(new THREE.CubeGeometry(boxsize[0] * 1, boxsize[1] * 1, boxsize[2] * 1), this.robotBaseMaterial);
    };

    RobotLink.prototype.makesphere = function(radius) {
      return this.meshvis = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), this.robotBaseMaterial);
    };

    RobotLink.prototype.makeempty = function() {
      return this.meshvis = new THREE.Mesh();
    };

    RobotLink.prototype.clearthislink = function() {
      return this.destroy();
    };

    return RobotLink;

  })(Backbone.Model);

  App.RobotMaterial = (function(_super) {

    __extends(RobotMaterial, _super);

    function RobotMaterial() {
      return RobotMaterial.__super__.constructor.apply(this, arguments);
    }

    RobotMaterial.prototype.initialize = function() {
      var check, def, rgba;
      this.id = this.get("name");
      if (_.has(this.attributes, "color")) {
        rgba = App.el2array(_.has(this.attributes.color, "rgba") && this.attributes.color.rgba, def = "0 0 0 1", check = true);
        this.set("color", new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]));
      }
      return this;
    };

    return RobotMaterial;

  })(Backbone.Model);

  App.RobotMaterialCollection = (function(_super) {

    __extends(RobotMaterialCollection, _super);

    function RobotMaterialCollection() {
      return RobotMaterialCollection.__super__.constructor.apply(this, arguments);
    }

    RobotMaterialCollection.prototype.model = App.RobotMaterial;

    return RobotMaterialCollection;

  })(Backbone.Collection);

  App.RobotLinkCollection = (function(_super) {

    __extends(RobotLinkCollection, _super);

    function RobotLinkCollection() {
      return RobotLinkCollection.__super__.constructor.apply(this, arguments);
    }

    RobotLinkCollection.prototype.model = App.RobotLink;

    return RobotLinkCollection;

  })(Backbone.Collection);

  App.RobotJointCollection = (function(_super) {

    __extends(RobotJointCollection, _super);

    function RobotJointCollection() {
      return RobotJointCollection.__super__.constructor.apply(this, arguments);
    }

    RobotJointCollection.prototype.model = App.RobotJoint;

    return RobotJointCollection;

  })(Backbone.Collection);

  App.RobotJointManipAll = (function(_super) {

    __extends(RobotJointManipAll, _super);

    function RobotJointManipAll() {
      var _this = this;
      this.changejointval = function(name, value) {
        return RobotJointManipAll.prototype.changejointval.apply(_this, arguments);
      };
      this.changepose = function(posearray, namesarray) {
        return RobotJointManipAll.prototype.changepose.apply(_this, arguments);
      };
      this.add2gui = function(joint) {
        return RobotJointManipAll.prototype.add2gui.apply(_this, arguments);
      };
      return RobotJointManipAll.__super__.constructor.apply(this, arguments);
    }

    RobotJointManipAll.prototype.el = $("#menu");

    RobotJointManipAll.prototype.jointsarray = {};

    RobotJointManipAll.prototype.initialize = function() {
      this.gui = this.options.gui || new dat.GUI();
      this.joints = this.options.joints;
      this.anglesfolder = this.gui.addFolder("Joint values");
      return this.joints.each(this.add2gui);
    };

    RobotJointManipAll.prototype.add2gui = function(joint) {
      return this.jointsarray[joint.get("name")] = new App.RobotJointManipSingle({
        joint: joint,
        gui: this.anglesfolder
      });
    };

    RobotJointManipAll.prototype.changepose = function(posearray, namesarray) {
      var index, name, _i, _len;
      if (posearray.length !== namesarray.length) {
        console.log("pose and namearray have different lenghts");
        return false;
      }
      for (index = _i = 0, _len = namesarray.length; _i < _len; index = ++_i) {
        name = namesarray[index];
        this.changejointval(name, posearray[index]);
      }
      return this;
    };

    RobotJointManipAll.prototype.changejointval = function(name, value) {
      this.jointsarray[name].changeval(value, true);
      return this;
    };

    return RobotJointManipAll;

  })(Backbone.View);

  App.RobotJointManipSingle = (function(_super) {

    __extends(RobotJointManipSingle, _super);

    function RobotJointManipSingle() {
      var _this = this;
      this.changeval = function(value, updateController) {
        if (updateController == null) {
          updateController = false;
        }
        return RobotJointManipSingle.prototype.changeval.apply(_this, arguments);
      };
      return RobotJointManipSingle.__super__.constructor.apply(this, arguments);
    }

    RobotJointManipSingle.prototype.initialize = function() {
      this.joint = this.options.joint;
      this.gui = this.options.gui;
      this.dummy = {};
      this.dummy["val"] = 0;
      if (this.joint.type !== "fixed") {
        this.controller = this.gui.add(this.dummy, "val", this.joint.lower, this.joint.upper, 0.01).name(this.joint.get("name"));
        return this.controller.onChange(this.changeval);
      }
    };

    RobotJointManipSingle.prototype.changeval = function(value, updateController) {
      if (updateController == null) {
        updateController = false;
      }
      if ((this.joint.upper >= value && value >= this.joint.lower)) {
        this.joint.movejoint(value);
        if (updateController) {
          this.dummy["val"] = value;
          this.controller.updateDisplay();
        }
      } else {
        console.log(this.joint.get("name") + " not between min max");
      }
      return this;
    };

    return RobotJointManipSingle;

  })(Backbone.View);

  window.clearall = function(scene, robot, jointcollection, modelcollection) {
    scene.remove(robot);
    jointcollection.reset();
    return modelcollection.reset();
  };

  App.RobotForm = (function(_super) {

    __extends(RobotForm, _super);

    function RobotForm() {
      return RobotForm.__super__.constructor.apply(this, arguments);
    }

    RobotForm.prototype.el = $("#robodiv");

    RobotForm.prototype.events = {
      "click #loadbutton": "resetNload"
    };

    RobotForm.prototype.resetNload = function() {
      var urdffromform;
      urdffromform = $(this.el).find("#robottext").val();
      window.clearall(window.scene, window.robot, window.robotjointcollection, window.robotlinkcollection);
      window.parseRobot(urdffromform);
      App.setupGui();
      return console.log(urdffromform);
    };

    return RobotForm;

  })(Backbone.View);

}).call(this);
