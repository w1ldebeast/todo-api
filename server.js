var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var middleware = require('./middleware.js')(db);

var app =express();
var PORT = process.env.PORT || 3000;
var todos = [];
var todoNextId = 1;

app.use(bodyParser.json());

app.get('/', function (req, res) {
	res.send('Todo API Root');
});

// GET /todos
app.get('/todos', middleware.requireAuthentication, function (req, res) {
	var query = req.query
	var where = {
		userId: req.user.get('id')
	};

	if (query.hasOwnProperty('completed') && query.completed === "true") {
		where.completed = true;
	} else if (query.hasOwnProperty('completed') && query.completed === "false") {
		where.completed = false;
	}

	if (query.hasOwnProperty('q') && query.q.length > 0) {
		where.description = { $like: '%' + query.q + '%'};
	}

	
	db.todo.findAll({where: where}).then(function (todos) {
		req.user.find
	});
	
	db.todo.findAll({where: where}).then(function (todos) {
		if (!todos) {
			return res.status(404).send();
		}	
		return res.json(todos);	
	}, function (e) {
		res.status(500).send();
	});	

});

// GET /todos/:id
app.get('/todos/:id', middleware.requireAuthentication, function (req, res) {
	var where = {
		userId:  req.user.get('id'),
		id: parseInt(req.params.id, 10)
	};

	db.todo.findOne({where: where}).then( function(todo) {
		if (!todo) {
			return res.status(404).send();
		}
		return res.json(todo.toJSON());
	}, function (error) {
		res.status(500).send();
	});
});

//POST /todos
app.post('/todos', middleware.requireAuthentication, function (req,res) {
	var body = _.pick(req.body, 'description', 'completed');
		 
	
	db.todo.create(body).then(function (todo) {
		req.user.addTodo(todo).then(function () {
			return todo.reload();
		}).then(function (todo) {
			res.json(todo.toJSON());
		});
	}, function (error) {
		res.status(400).json(error);
	});
});

//DELETE /todos/:id
app.delete('/todos/:id', middleware.requireAuthentication, function (req,res) {
	
	db.todo.destroy({
		where: {
			userId: req.user.get('id'),
			id: parseInt(req.params.id, 10)
		}	

	}).then(function (rowsDeleted) {
		
		if (rowsDeleted === 0) {
			 res.status(404).send();
		} else {
			res.status(204).send();
		}

	}, function (error) {
		res.status(500).send();
	});
});

//PUT /todos/:id
app.put('/todos/:id', middleware.requireAuthentication, function(req, res) {
	var body = _.pick(req.body, 'description', 'completed');
	var attributes = {};
	var where = {
		userId: req.user.get('id'),
		id: parseInt(req.params.id, 10)
	};

	if (body.hasOwnProperty('completed')) {
		attributes.completed = body.completed;
	}

	if (body.hasOwnProperty('description')) {
		attributes.description = body.description;
	} else if (body.hasOwnProperty('description')) {
		return res.status(400).send();	
	} 

	db.todo.findOne({where: where}).then(function (todo) {
		if (todo) {
			todo.update(attributes).then(function (todo) {
				res.json(todo.toJSON());
			}, function (e) {
				res.status(400).json(e);
			});		
		} else {
			res.status(404).send();
		}
	}, function () {
		res.status(500).send();
	})
});

//POST /users

app.post('/users', function (req, res) {
	var body = _.pick(req.body, 'email', 'password');

	db.user.create(body).then(function (user) {
		res.json(user.toPublicJSON());
	}, function (e) {
		res.status(400).send(e);
	});


});

//POST /users/login
app.post('/users/login', function(req, res) {
	var body = _.pick(req.body, 'email', 'password')
	var userInstance;	

	db.user.authenticate(body).then(function (user) {
		var token = user.generateToken('authentication');
		userInstance = user;	
		return db.token.create({token: token});

	}).then(function (tokenInstance) {
		res.header('Auth', tokenInstance.get('token')).json(userInstance.toPublicJSON());
	}).catch(function () {
		res.status(401).send();
	});

});

//DELETE /users/login
app.delete('/users/login', middleware.requireAuthentication, function (req, res) {
	req.token.destroy().then(function () {
		res.status(204).send();
	}).catch(function () {
		res.status(500).send();
	});
});

 
db.sequelize.sync({force: true}).then(function () {
	app.listen(PORT, function () {
		console.log('Server started on port: ' + PORT);
	});
});

